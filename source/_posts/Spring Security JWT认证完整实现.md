---
title: Spring Security JWT认证完整实现
description: 详细讲解基于Spring Security和JWT的前后端分离认证方案，包括匿名用户处理、权限控制、免认证注解、JWT工具类、过滤器配置和登录接口实现等核心组件。
tags:
  - Java
  - spring boot
  - spring
  - Spring Security
categories:
  - 开发笔记
date: '2025-10-11 20:58:57'
recommend: true
cover: 'https://cdn.luoyuanxiang.top/cover-spring-security-jwt.webp'
abbrlink: '52e4454'
---

## 一、自定义匿名用户访问返回处理：`AnonymousAuthenticationEntryPoint`

### 核心作用

当**未登录的匿名用户**访问需要认证的接口时，替代 Security 默认的「401 页面响应」，返回自定义的 JSON 格式提示（明确告知 “未登录”），适配前后端分离场景（前端需解析 JSON 做跳转或提示）。

```java
/**
 * 匿名用户访问处理
 * 核心：拦截匿名用户的未认证请求，返回统一JSON格式的“未登录”提示
 *
 * @author luoyuanxiang
 */
@Slf4j
@Component // 注入Spring容器，供Security配置使用
public class AnonymousAuthenticationEntryPoint implements AuthenticationEntryPoint {
    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException authException) throws IOException, ServletException {
        // 1. 日志记录：打印访问失败的接口路径和异常信息，方便排查问题
        log.info("用户需要登录，访问[{}]失败，AuthenticationException={}", request.getRequestURI(), authException.getMessage(), authException);
        
        // 2. 跨域配置：允许前端跨域请求（前后端分离必配，否则前端无法解析响应）
        response.setHeader("Access-Control-Allow-Origin", "*");
        // 3. 响应格式：指定返回JSON，避免前端解析乱码
        response.setHeader("Content-type", "application/json;charset=UTF-8");
        
        // 4. 自定义响应体：使用项目统一的Result工具类，状态码424（自定义，区分“未登录”和其他401场景）
        Result<String> object = Result.error(424, "未登录，请登录访问");
        // 5. 写入响应：将Result转为JSON字符串返回
        response.getWriter().print(JSONUtil.toJsonStr(object));
    }
}
```

## 二、自定义权限访问异常处理：`CustomAccessDeniedHandler`

### 核心作用

当**已登录但权限不足**的用户访问接口时（比如普通用户访问管理员接口），替代 Security 默认的「403 页面响应」，返回自定义 JSON 格式的 “无权限” 提示，适配前后端分离。

```java
/**
 * 授权异常处理
 * 核心：拦截已登录用户的“权限不足”请求，返回统一JSON格式的“无权限”提示
 *
 * @author luoyuanxiang
 */
@Component // 注入Spring容器，供Security配置使用
public class CustomAccessDeniedHandler implements AccessDeniedHandler {
    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, AccessDeniedException accessDeniedException) throws IOException, ServletException {
        // 1. 自定义响应体：状态码403（HTTP标准“禁止访问”码），提示“无权限”
        Result<Object> error = Result.error(403, "无权限访问");
        
        // 2. 跨域与响应格式配置：同匿名用户处理，确保前端能解析
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Content-type", "application/json;charset=UTF-8");
        
        // 3. 写入响应：返回JSON
        response.getWriter().print(JSONUtil.toJsonStr(error));
    }
}
```

## 三、自定义跳过认证注解类和 AOP 实现

### 3.1 免认证注解：`NoAuth`

#### 核心作用

定义一个「标记注解」，用于标注**不需要登录就能访问的接口 / 控制器**（比如登录接口、注册接口、验证码接口），替代传统的 “在 Security 配置中硬编码白名单路径”，更灵活易维护。

```java
/**
 * 无需认证token注解
 * 核心：标记接口/控制器，告知Security“该路径免登录访问”
 *
 * @author luoyuanxiang
 */
@Documented // 生成API文档时，显示该注解
@Retention(RetentionPolicy.RUNTIME) // 注解保留到运行时（必须，因为需要在运行时扫描）
@Target({ElementType.METHOD, ElementType.TYPE}) // 注解可用于：方法（单个接口）、类（整个控制器）
public @interface NoAuth {
}
```

### 3.2 免认证路径收集：`RequestMappingCollector`

#### 核心作用

通过实现 Spring 的 `BeanPostProcessor` 接口，在项目启动时**自动扫描所有加了 @NoAuth 注解的接口路径**，收集成 “免认证白名单”，供 Security 配置使用（避免手动写死白名单）。

```java
/**
 * 免认证token配置（原注释“无线”应为笔误）
 * 核心：项目启动时扫描@NoAuth注解，自动收集免认证路径，生成白名单
 *
 * @author luoyuanxiang
 */
@Service // 注入Spring容器，启动时自动执行BeanPostProcessor逻辑
public class RequestMappingCollector implements BeanPostProcessor {

    // 存储免认证路径的白名单：用LinkedHashSet保证顺序且去重（避免同一路径重复添加）
    @Getter
    @Setter
    private Set<String> permitAllUrls = new LinkedHashSet<>();


    @Override
    public Object postProcessAfterInitialization(Object bean, String beanName) throws BeansException {
        // 1. 判断当前Bean是否是“请求映射处理器”（负责管理所有@RequestMapping接口的Bean）
        if (bean instanceof RequestMappingHandlerMapping handlerMapping) {
            // 2. 获取所有接口的“请求映射信息”（key：映射规则，value：对应的方法）
            Map<RequestMappingInfo, HandlerMethod> handlerMethods = handlerMapping.getHandlerMethods();
            
            // 3. 遍历所有接口，判断是否加了@NoAuth
            for (Map.Entry<RequestMappingInfo, HandlerMethod> entry : handlerMethods.entrySet()) {
                RequestMappingInfo info = entry.getKey(); // 接口的路径信息（如@RequestMapping("/login")）
                HandlerMethod method = entry.getValue(); // 接口对应的Controller方法

                // 4. 检查：Controller类或方法是否加了@NoAuth注解
                boolean hasNoAuth = AnnotationUtils.findAnnotation(method.getBeanType(), NoAuth.class) != null // 类上的注解
                        || AnnotationUtils.findAnnotation(method.getMethod(), NoAuth.class) != null; // 方法上的注解

                // 5. 若加了@NoAuth，将接口路径加入白名单
                if (hasNoAuth) {
                    // 获取接口的所有路径（如@RequestMapping({"/a","/b"})会返回两个路径）
                    permitAllUrls.addAll(info.getPathPatternsCondition().getPatternValues());
                }
            }
        }
        // 6. BeanPostProcessor接口要求返回原Bean，不修改Bean本身
        return bean;
    }
}
```

## 四、自定义实现登录用户信息：`SecurityUser`

### 核心作用

继承 Security 提供的 `User` 类（实现 `UserDetails` 接口），扩展存储**项目自定义的用户实体（UserEntity）** —— 因为 Security 默认的 `User` 只包含用户名、密码、权限，无法满足业务需求（比如需要用户 ID、昵称等）。

```java
/**
 * 登录用户详情
 * 核心：扩展Security的User类，关联项目自定义的UserEntity，存储完整用户信息
 *
 * @author luoyuanxiang
 */
@Getter
@Setter
public class SecurityUser extends User { // 继承Security的User，自动实现UserDetails接口

    // 扩展字段：关联项目自定义的用户实体（存储用户ID、昵称、角色等业务字段）
    private UserEntity userEntity;

    // 构造方法：调用父类构造（传递Security必需的用户名、密码、权限）
    public SecurityUser(String username, String password, Collection<? extends GrantedAuthority> authorities) {
        super(username, password, authorities);
    }
}
```

## 五、自定义实现 `UserDetailsService` 接口：`UserDetailsServiceImpl`

### 核心作用

实现 Security 的 `UserDetailsService` 接口，是**用户认证的核心数据源**—— 当用户登录时，Security 会调用该类的 `loadUserByUsername` 方法，从数据库查询用户信息，供后续密码校验和权限赋值。

```java
/**
 * 实现 UserDetailsService 接口的用户详情服务类
 * 核心：登录时查询数据库获取用户信息，封装成Security能识别的SecurityUser
 *
 * @author luoyuanxiang
 */
@Service // 注入Spring容器，供Security的AuthenticationManager使用
public class UserDetailsServiceImpl implements UserDetailsService {

    // 注入项目的用户业务服务（用于从数据库查用户）
    @Resource
    private IUserService userService;

    @Override
    public SecurityUser loadUserByUsername(String username) throws UsernameNotFoundException {
        // 1. 根据用户名查询数据库：调用业务层方法，获取自定义UserEntity
        UserEntity userEntity = userService.findByUsername(username);
        // 2. 若用户不存在，抛出Security标准异常（会被后续异常处理器捕获，返回“用户不存在”）
        if (userEntity == null) {
            throw new UsernameNotFoundException("用户不存在：" + username);
        }

        // 3. 构建用户权限集合：从UserEntity中获取权限编码（如“user:list”），转为Security的GrantedAuthority
        Collection<GrantedAuthority> authorities = new ArrayList<>();
        if (StrUtil.isNotBlank(userEntity.getPermissionsCode())) { // 若用户有权限编码（非空）
            // 拆分权限编码（假设数据库存储格式为“user:list,user:add”）
            for (String code : userEntity.getPermissionsCode().split(",")) {
                authorities.add(new SimpleGrantedAuthority(code)); // 每个编码对应一个权限
            }
        }

        // 4. 封装成SecurityUser：关联UserEntity，传递用户名、密码（数据库存储的加密后密码）、权限
        SecurityUser securityUser = new SecurityUser(userEntity.getUsername(), userEntity.getPassword(), authorities);
        securityUser.setUserEntity(userEntity);

        // 5. 返回SecurityUser：供Security后续校验密码、设置认证信息
        return securityUser;
    }
}
```

## 六、JWT 工具类和 JWT 过滤器实现

### 6.1 JWT 工具类：`JwtUtils`

#### 核心作用

封装 JWT 的核心操作：**生成 Token（登录成功后返回给前端）、解析 Token（从请求头提取用户信息）、验证 Token（是否过期、签名是否合法）**，是前后端分离认证的 “核心工具”。

```java
/**
 * JWT 工具类，用于生成、解析和验证 JWT token
 * 核心：处理JWT的全生命周期，依赖配置文件中的密钥和过期时间
 *
 * @author luoyuanxiang
 */
@Component // 注入Spring容器，供登录接口和JWT过滤器使用
public class JwtUtils {

    // 从配置文件读取JWT密钥（如application.yml中的jwt.secret）
    @Value("${jwt.secret}")
    private String jwtSecret;

    // 从配置文件读取JWT过期时间（毫秒，如3600000=1小时）
    @Value("${jwt.expiration}")
    private int jwtExpirationMs;

    /**
     * 从Token中提取用户名（Subject字段，JWT标准字段）
     */
    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    /**
     * 从Token中提取过期时间（Expiration字段，JWT标准字段）
     */
    public Date extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration);
    }

    /**
     * 通用方法：从Token中提取指定的“声明”（Claim，JWT的自定义字段或标准字段）
     */
    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token); // 先提取所有声明
        return claimsResolver.apply(claims); // 根据传入的函数获取指定声明
    }

    /**
     * 提取Token中的所有声明（包括标准字段和自定义字段）
     */
    private Claims extractAllClaims(String token) {
        // JWT解析器构建：设置签名密钥（必须和生成Token时一致，否则解析失败）
        return Jwts.parserBuilder()
                .setSigningKey(key()) // 传入密钥（见下方key()方法）
                .build()
                .parseClaimsJws(token) // 解析Token（若签名不合法、格式错误，会抛异常）
                .getBody(); // 获取声明体
    }

    /**
     * 检查Token是否过期
     */
    public Boolean isTokenExpired(String token) {
        // 比较Token的过期时间和当前时间：若过期时间在当前时间之前，说明已过期
        return extractExpiration(token).before(new Date());
    }

    /**
     * 生成JWT Token（登录成功后调用）
     * @param userDetails：Security的用户详情（包含用户名、权限等）
     */
    public String generateToken(UserDetails userDetails) {
        Map<String, Object> claims = new HashMap<>(); // 自定义声明（可添加用户ID、角色等）
        return createToken(claims, userDetails.getUsername()); // 传入自定义声明和用户名（Subject）
    }

    /**
     * 生成签名密钥：将配置文件中的字符串密钥转为JWT要求的SecretKey（Base64解码）
     */
    private SecretKey key() {
        byte[] keyBytes = Decoders.BASE64.decode(jwtSecret); // 解码Base64格式的密钥
        return Keys.hmacShaKeyFor(keyBytes); // 生成HS256算法的密钥（和生成Token时的签名算法一致）
    }

    /**
     * 实际创建Token的方法（封装JWT标准字段）
     */
    private String createToken(Map<String, Object> claims, String subject) {
        return Jwts.builder()
                .setClaims(claims) // 设置自定义声明
                .setSubject(subject) // 设置用户名（Subject，JWT标准字段）
                .setIssuedAt(new Date(System.currentTimeMillis())) // 设置签发时间（标准字段）
                .setExpiration(new Date(System.currentTimeMillis() + jwtExpirationMs)) // 设置过期时间
                .signWith(key(), SignatureAlgorithm.HS256) // 设置签名算法和密钥
                .compact(); // 生成Token字符串
    }

    /**
     * 验证Token合法性：1. 用户名匹配 2. Token未过期
     */
    public Boolean validateToken(String token, UserDetails userDetails) {
        final String username = extractUsername(token); // 从Token提取用户名
        // 验证：用户名和userDetails中的一致 + Token未过期
        return (username.equals(userDetails.getUsername()) && !isTokenExpired(token));
    }

    /**
     * 从请求头中解析Token：前端需将Token放在Authorization头，格式为“Bearer {token}”
     */
    public String parseJwt(HttpServletRequest request) {
        String headerAuth = request.getHeader("Authorization"); // 获取Authorization头
        // 检查头信息是否符合“Bearer ”前缀（前后端约定的格式）
        if (headerAuth != null && headerAuth.startsWith("Bearer ")) {
            return headerAuth.substring(7); // 截取“Bearer ”后的Token字符串（7是“Bearer ”的长度）
        }
        return null; // 无Token或格式错误，返回null
    }
}
```

### 6.2 JWT 过滤器：`JwtAuthenticationFilter`

#### 核心作用

继承 Security 的 `OncePerRequestFilter`（确保每次请求只执行一次），**拦截所有请求**，从请求头提取 JWT Token，验证合法性后将用户信息存入 `SecurityContext`（让 Security 后续能识别 “当前用户已登录”）。

```java
/**
 * JWT 认证过滤器，用于拦截请求并验证 JWT token
 * 核心：每次请求前验证Token，合法则设置认证信息，让Security识别已登录用户
 *
 * @author luoyuanxiang
 */
public class JwtAuthenticationFilter extends OncePerRequestFilter { // 确保单次请求只执行一次过滤

    // 注入JWT工具类（解析、验证Token）
    @Resource
    private JwtUtils jwtUtils;

    // 注入UserDetailsService（验证Token时需查询用户信息）
    @Resource
    private UserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {
        try {
            // 1. 从请求头解析Token
            String jwt = jwtUtils.parseJwt(request);
            
            // 2. 若Token不为null（存在Token）
            if (Objects.nonNull(jwt)) {
                // 3. 从Token提取用户名
                String username = jwtUtils.extractUsername(jwt);
                // 4. 从数据库查询用户信息（封装成UserDetails）
                UserDetails userDetails = userDetailsService.loadUserByUsername(username);
                // 5. 验证Token合法性（用户名匹配 + 未过期）
                if (jwtUtils.validateToken(jwt, userDetails)) {
                    // 6. 构建认证信息：Security的UsernamePasswordAuthenticationToken（存储用户信息和权限）
                    UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                            userDetails, null, userDetails.getAuthorities()); // 密码设为null（已通过Token验证，无需密码）
                    // 设置请求详情（如IP、会话ID，可选但建议加）
                    authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    // 7. 将认证信息存入SecurityContext：后续Security会从这里获取当前用户信息
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
            }
        } catch (Exception e) {
            // 8. 捕获异常（如Token无效、过期）：打印日志，不中断过滤器链（让后续流程处理未认证情况）
            logger.error("Cannot set user authentication: {}", e);
        }
        // 9. 继续执行过滤器链：无论是否有认证信息，都让请求进入下一个过滤器（如授权过滤器）
        filterChain.doFilter(request, response);
    }
}
```

## 七、Spring Security 配置：`SecurityConfig`

### 核心作用

Security 的**核心配置类**：整合上述所有自定义组件（过滤器、异常处理器、白名单），配置认证授权规则（哪些路径免认证、哪些需权限）、跨域、会话管理等，是整个 Security 流程的 “总指挥”。

```java
/**
 * Spring Security 配置类
 * 核心：整合所有自定义组件，定义认证授权规则，配置Security核心流程
 *
 * @author luoyuanxiang
 */
@Configuration // 标记为配置类
@EnableWebSecurity // 启用Spring Security功能
@EnableMethodSecurity // 启用方法级别的权限控制（如@PreAuthorize("hasRole('ADMIN')")）
public class SecurityConfig {

    // 注入免认证路径收集器（存储@NoAuth标注的路径）
    @Resource
    private RequestMappingCollector requestMappingCollector;
    // 注入匿名用户异常处理器
    @Resource
    private AnonymousAuthenticationEntryPoint anonymousAuthenticationEntryPoint;
    // 注入权限不足异常处理器
    @Resource
    private CustomAccessDeniedHandler customAccessDeniedHandler;

    /**
     * 自定义权限服务（假设项目需要自定义权限表达式，如@PreAuthorize("@pms.hasPerm('user:list')")）
     * 核心：提供自定义权限校验逻辑，供方法级注解使用
     */
    @Bean("pms") // 命名为pms，对应注解中的@pms
    public PermissionService permissionService() {
        return new PermissionService();
    }

    /**
     * 支持自定义权限表达式（配合@EnableMethodSecurity）
     * 核心：让Security识别自定义的权限服务（如@pms）
     */
    @Bean
    public AnnotationTemplateExpressionDefaults prePostTemplateDefaults() {
        return new AnnotationTemplateExpressionDefaults();
    }

    /**
     * 注册JWT过滤器到Spring容器
     */
    @Bean
    public JwtAuthenticationFilter jwtAuthenticationFilter() {
        return new JwtAuthenticationFilter();
    }

    /**
     * 跨域配置（前后端分离必配）
     * 核心：定义允许的跨域规则（域名、方法、请求头），替代之前处理器中的硬编码跨域头
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOriginPatterns(List.of("*")); // 允许所有域名（生产环境建议指定具体域名，如"http://localhost:8080"）
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH")); // 允许的HTTP方法
        configuration.setAllowedHeaders(List.of("*")); // 允许的请求头（如Authorization、Content-Type）
        configuration.setAllowCredentials(true); // 允许携带Cookie（若前端需要传Cookie，需开启）
        
        // 注册跨域规则：所有路径都适用
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    /**
     * 核心配置：定义Security的过滤器链（认证授权流程）
     */
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                // 1. 配置跨域：使用上述corsConfigurationSource
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                // 2. 禁用CSRF：前后端分离项目中，CSRF令牌难以传递，且JWT本身已防篡改，故禁用
                .csrf(AbstractHttpConfigurer::disable)
                // 3. 会话管理：设置为无状态（STATELESS），因为JWT是无状态认证，不依赖Session
                .sessionManagement(se -> se.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                // 4. 授权规则配置
                .authorizeHttpRequests(auth -> auth
                        // 4.1 免认证路径：从requestMappingCollector获取@NoAuth标注的路径，允许匿名访问
                        .requestMatchers(requestMappingCollector.getPermitAllUrls().toArray(new String[0]))
                        .permitAll()
                        // 4.2 其他所有路径：必须认证（已登录）才能访问
                        .anyRequest()
                        .authenticated())
                // 5. 禁用默认登录页面：前后端分离用自定义登录接口（/login），故禁用Security默认表单登录
                .formLogin(AbstractHttpConfigurer::disable)
                // 6. 禁用默认退出：后续可自定义退出接口（如/logout，将Token加入黑名单），故禁用默认退出
                .logout(AbstractHttpConfigurer::disable)
                // 7. 异常处理：配置匿名用户和权限不足的异常处理器
                .exceptionHandling(exception -> {
                    exception.authenticationEntryPoint(anonymousAuthenticationEntryPoint); // 未登录异常
                    exception.accessDeniedHandler(customAccessDeniedHandler); // 权限不足异常
                })
                // 8. 添加JWT过滤器：将JWT过滤器放在UsernamePasswordAuthenticationFilter之前（先验证Token，再执行后续认证）
                .addFilterBefore(jwtAuthenticationFilter(), UsernamePasswordAuthenticationFilter.class);
        
        // 返回配置好的过滤器链
        return http.build();
    }

    /**
     * 密码编码器：使用BCrypt算法加密密码（Security推荐，不可逆，带盐值）
     * 核心：登录时Security会自动用该编码器校验密码（数据库存储BCrypt加密后的密码）
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * 注册认证管理器：供登录接口使用（调用authenticate方法校验用户名密码）
     */
    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authenticationConfiguration) throws Exception {
        return authenticationConfiguration.getAuthenticationManager();
    }
}
```

## 八、登录实现：`AuthController`

### 核心作用

提供**自定义登录接口**（`/login`）和 Token 校验接口（`/check`），是用户触发认证流程的入口：接收前端传入的用户名密码，调用 Security 的 `AuthenticationManager` 校验，成功后生成 JWT 返回给前端。

```java
/**
 * 登录控制器
 * 核心：提供自定义登录接口和Token校验接口，对接前端认证需求
 *
 * @author luoyuanxiang
 */
@RestController // 标记为REST接口控制器
public class AuthController {

    // 注入认证管理器（用于校验用户名密码）
    @Resource
    private AuthenticationManager authenticationManager;

    // 注入JWT工具类（生成Token）
    @Resource
    private JwtUtils jwtUtils;

    // 注入用户业务服务（可选，视业务需求）
    @Resource
    private IUserService userService;

    // 注入HttpServletRequest（用于从请求头提取Token，供/check接口使用）
    @Resource
    private HttpServletRequest request;

    /**
     * 用户登录接口（核心）
     * @NoAuth：标记为免认证路径（未登录用户也能访问）
     * @RequestBody：接收前端传入的JSON格式登录参数（用户名、密码）
     */
    @NoAuth
    @PostMapping("/login")
    public Result<JwtResponse> login(@RequestBody LoginRequest loginRequest) {
        // 1. 调用AuthenticationManager校验用户名密码：
        // 传入UsernamePasswordAuthenticationToken（封装用户名密码），内部会调用UserDetailsService查用户，并用PasswordEncoder校验密码
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(loginRequest.username(), loginRequest.password()));
        
        // 2. 校验成功：将认证信息存入SecurityContext（供后续流程使用，如JWT过滤器）
        SecurityContextHolder.getContext().setAuthentication(authentication);
        
        // 3. 获取当前登录用户的详情（SecurityUser，包含自定义的UserEntity）
        SecurityUser userDetails = (SecurityUser) authentication.getPrincipal();
        
        // 4. 生成JWT Token（传入SecurityUser，包含用户名和权限）
        String jwt = jwtUtils.generateToken(userDetails);
        
        // 5. 敏感信息处理：清空UserEntity中的密码（避免返回给前端）
        userDetails.getUserEntity().setPassword("只有聪明的人才能看到密码"); // 占位符，实际可设为null
        
        // 6. 返回登录结果：包含用户信息、角色、Token（用自定义JwtResponse封装）
        return Result.success(new JwtResponse(userDetails.getUserEntity(), userDetails.getUserEntity().getRole(), jwt));
    }

    /**
     * Token校验接口（可选）
     * 作用：前端可定期调用该接口，检查Token是否有效/过期
     */
    @GetMapping("/check")
    public Result<String> check() {
        try {
            // 1. 从请求头提取Token
            String token = jwtUtils.parseJwt(request);
            // 2. 检查Token是否过期
            boolean tokenExpired = jwtUtils.isTokenExpired(token);
            // 3. 返回结果：过期则提示“token已过期”，否则返回成功
            return tokenExpired ? Result.error(424, "token已过期") : Result.success();
        } catch (Exception ignored) {
            // 4. 捕获异常（如Token无效、格式错误）：返回“token无效”
        }
        return Result.error(424, "token 无效");
    }

    /**
     * 登录请求体（使用Java Record，简洁替代POJO）
     * 核心：封装前端传入的登录参数（用户名、密码），实现Serializable便于序列化
     */
    public record LoginRequest(String username, String password) implements Serializable {
    }

    /**
     * 登录响应体（使用Java Record）
     * 核心：封装登录成功后返回给前端的数据（用户信息、角色、Token）
     */
    public record JwtResponse(UserEntity user, RoleEntity role, String token) {
    }
}
```

## 整体流程总结

1. **未登录访问需认证接口**：JWT 过滤器未提取到有效 Token → Security 触发 `AnonymousAuthenticationEntryPoint` → 返回 “未登录” JSON。
2. **已登录但权限不足**：JWT 验证通过，但用户权限不匹配 → Security 触发 `CustomAccessDeniedHandler` → 返回 “无权限” JSON。
3. **登录流程**：前端调用 `/login`（@NoAuth 免认证）→ 传入用户名密码 → `AuthenticationManager` 校验 → 成功生成 JWT → 返回给前端。
4. **已登录访问接口**：前端在 Authorization 头携带 JWT → JWT 过滤器解析验证 Token → 合法则设置认证信息 → Security 允许访问接口。