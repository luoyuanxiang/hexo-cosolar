---
title: Shiro与JWT整合实现分布式认证
description: 本文介绍了在分布式系统中使用Shiro进行权限控制，结合JWT替代Session解决跨域和集群认证问题，包含核心代码实现和配置示例。
tags:
- Java
- spring
- spring boot
- shiro
- 基础
- jwt
categories:
- 开发笔记
cover: https://cdn.luoyuanxiang.top/cover-shiro-jwt-auth.webp
date: '2025-09-04 14:57:00'
---

一、思路

`shiro` 用来认证用户及权限控制，`jwt`用来生成一个`token`，暂存用户信息。

为什么不使用`session`而使用`jwt`？传统情况下是只有一个服务器，用户登陆后将一些信息以session的形式存储服务器上，

然后将`sessionid`存储在本地`cookie`中，当用户下次请求时将会将`sessionid`传递给服务器，用于确认身份。

但如果是分布式的情况下会出现问题，在服务器集群中，需要一个`session`数据库来存储每一个session，提供给集群中所有服务使用，且无法跨域(多个Ip)使用。

而`jwt`是生成一个`token`存储在客户端，每次请求将其存储在`header`中，解决了跨域，且可以通过自定义的方法进行验证，解决了分布式验证的问题。

缺点：无法在服务器注销、比`sessionid`大占带宽、一次性（想修改里面的内容，就必须签发一个新的`jwt`）

二、废话不多说上代码

`pom.xml`

```xml
<dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <optional>true</optional>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
            <exclusions>
                <exclusion>
                    <groupId>org.junit.vintage</groupId>
                    <artifactId>junit-vintage-engine</artifactId>
                </exclusion>
            </exclusions>
        </dependency>
        <dependency>
            <groupId>org.mybatis.spring.boot</groupId>
            <artifactId>mybatis-spring-boot-starter</artifactId>
            <version>2.1.2</version>
            <exclusions>
                <exclusion>
                    <groupId>org.mybatis</groupId>
                    <artifactId>mybatis-spring</artifactId>
                </exclusion>
            </exclusions>
        </dependency>
        <dependency>
            <groupId>mysql</groupId>
            <artifactId>mysql-connector-java</artifactId>
            <scope>runtime</scope>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-aop</artifactId>
        </dependency>
        <!-- 工具 -->
        <dependency>
            <groupId>cn.hutool</groupId>
            <artifactId>hutool-all</artifactId>
            <version>5.2.3</version>
        </dependency>
        <!-- 密码加密 -->
        <dependency>
            <groupId>com.github.ulisesbocchio</groupId>
            <artifactId>jasypt-spring-boot-starter</artifactId>
            <version>2.1.0</version>
        </dependency>

        <dependency>
            <groupId>com.alibaba</groupId>
            <artifactId>fastjson</artifactId>
            <version>1.2.62</version>
        </dependency>

        <!-- mybatis-plus -->
        <dependency>
            <groupId>com.baomidou</groupId>
            <artifactId>mybatis-plus-boot-starter</artifactId>
            <version>3.3.1</version>
            <exclusions>
                <exclusion>
                    <groupId>org.mybatis</groupId>
                    <artifactId>mybatis</artifactId>
                </exclusion>
            </exclusions>
        </dependency>

        <!-- 数据源 -->
        <dependency>
            <groupId>com.alibaba</groupId>
            <artifactId>druid-spring-boot-starter</artifactId>
            <version>1.1.21</version>
        </dependency>

        <!-- xss过滤组件 -->
        <dependency>
            <groupId>org.jsoup</groupId>
            <artifactId>jsoup</artifactId>
            <version>1.9.2</version>
        </dependency>

        <!-- restful api 文档 swagger2 -->
        <dependency>
            <groupId>io.springfox</groupId>
            <artifactId>springfox-swagger2</artifactId>
            <version>2.9.2</version>
        </dependency>

        <dependency>
            <groupId>com.github.xiaoymin</groupId>
            <artifactId>swagger-bootstrap-ui</artifactId>
            <version>1.9.3</version>
        </dependency>

```

重构`token`生成继承 `AuthenticationToken` 类

```java
package com.luoyx.vjsb.authority.token;

import lombok.Data;
import org.apache.shiro.authc.AuthenticationToken;

/**
* <p>
* 自定义token
* </p>
*
* @author luoyuanxiang <p>luoyuanxiang.github.io</p>
* @since 2020/3/19 17:06
  */
  @Data
  public class Oauth2Token implements AuthenticationToken {
  private static final long serialVersionUID = 8585428037102822625L;

  /**
    * json web token值
      */
      private String jwt;

  public Oauth2Token(String jwt) {
  this.jwt = jwt;
  }

  /**
    * jwt
    *
    * @return jwt
      */
      @Override
      public Object getPrincipal() {
      return this.jwt;
      }

  /**
    * 返回jwt
    *
    * @return jwt
      */
      @Override
      public Object getCredentials() {
      return this.jwt;
      }
  }

```

自定义过滤器，继承 `AuthenticatingFilter` 类

```java
package com.luoyx.vjsb.authority.shiro.filter;

import cn.hutool.core.util.StrUtil;
import cn.hutool.json.JSONUtil;
import com.alibaba.fastjson.JSON;
import com.luoyx.vjsb.authority.token.Oauth2Token;
import com.luoyx.vjsb.authority.util.JsonWebTokenUtil;
import com.luoyx.vjsb.authority.vo.JwtAccount;
import com.luoyx.vjsb.common.properties.VjsbProperties;
import com.luoyx.vjsb.common.util.AjaxResult;
import com.luoyx.vjsb.common.util.IpUtil;
import io.jsonwebtoken.SignatureAlgorithm;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.apache.shiro.authc.AuthenticationException;
import org.apache.shiro.authc.AuthenticationToken;
import org.apache.shiro.web.filter.authc.AuthenticatingFilter;
import org.apache.shiro.web.util.WebUtils;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.RequestMethod;

import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
* <p>
* 自定义过滤器配置
* </p>
*
* @author luoyuanxiang <p>luoyuanxiang.github.io</p>
* @since 2020/3/19 17:34
  */
  @Slf4j
  @Setter
  public class Oauth2Filter extends AuthenticatingFilter {

  private final String expiredJwt = "expiredJwt";

  private StringRedisTemplate redisTemplate;

  private VjsbProperties properties;

  /**
    * 对跨域提供支持
      */
      @Override
      protected boolean preHandle(ServletRequest request, ServletResponse response) throws Exception {
      HttpServletRequest httpServletRequest = (HttpServletRequest) request;
      HttpServletResponse httpServletResponse = (HttpServletResponse) response;
      httpServletResponse.setHeader("Access-control-Allow-Origin", httpServletRequest.getHeader("Origin"));
      httpServletResponse.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS,PUT,DELETE");
      httpServletResponse.setHeader("Access-Control-Allow-Headers", httpServletRequest.getHeader("Access-Control-Request-Headers"));
      // 跨域时会首先发送一个option请求，这里我们给option请求直接返回正常状态
      if (httpServletRequest.getMethod().equals(RequestMethod.OPTIONS.name())) {
      httpServletResponse.setStatus(HttpStatus.OK.value());
      return false;
      }
      return super.preHandle(request, response);
      }

  /**
    * 先执行：isAccessAllowed 再执行onAccessDenied
    * 如果返回true的话，就直接返回交给下一个filter进行处理。
    * 如果返回false的话，回往下执行onAccessDenied
    *
    * @param request     the incoming <code>ServletRequest</code>
    * @param response    the outgoing <code>ServletResponse</code>
    * @param mappedValue the filter-specific config value mapped to this filter in the URL rules mappings.
    * @return <code>true</code> if the request should proceed through the filter normally, <code>false</code> if the
    * request should be processed by this filter's
    * {@link #onAccessDenied(ServletRequest, ServletResponse, Object)} method instead.
      */
      @Override
      protected boolean isAccessAllowed(ServletRequest request, ServletResponse response, Object mappedValue) {
      return ((HttpServletRequest) request).getMethod().equals(RequestMethod.OPTIONS.name());
      }

  /**
    * onAccessDenied：表示当访问拒绝时是否已经处理了；如果返回true表示需要继续处理；
    * 如果返回false表示该拦截器实例已经处理了，将直接返回即可。
    *
    * @param request  the incoming <code>ServletRequest</code>
    * @param response the outgoing <code>ServletResponse</code>
    * @return <code>true</code> if the request should continue to be processed; false if the subclass will
    * handle/render the response directly.
    * @throws Exception if there is an error processing the request.
      */
      @Override
      protected boolean onAccessDenied(ServletRequest request, ServletResponse response) throws Exception {
      String token = getRequestToken((HttpServletRequest) request);
      if (StrUtil.isBlank(token)) {
      AjaxResult.responseWrite(JSON.toJSONString(AjaxResult.success("无权限访问", 1007, null)), response);
      return false;
      }
      return executeLogin(request, response);
      }

  @Override
  protected AuthenticationToken createToken(ServletRequest request, ServletResponse response) throws Exception {
  // 这个创建token是在登录完成之后，去调用控制层时调用的，也就是要有token的时候，才会调用这个方法
  return new Oauth2Token(getRequestToken(WebUtils.toHttp(request)));
  }


    /**
     * 获取请求的token
     */
    private String getRequestToken(HttpServletRequest httpRequest) {
        //从header中获取token
        String token = httpRequest.getHeader("Authorization");

        //如果header中不存在token，则从参数中获取token
        if (StrUtil.isBlank(token)) {
            token = httpRequest.getParameter("Authorization");
        }

        return token;
    }

    /**
     * 登录失败处理
     *
     * @param token token
     * @param e 异常
     * @param request 1
     * @param response 2
     * @return boolean
     */
    @Override
    protected boolean onLoginFailure(AuthenticationToken token, AuthenticationException e, ServletRequest request, ServletResponse response) {
        //处理登录失败的异常
        Throwable throwable = e.getCause() == null ? e : e.getCause();
        PrintWriter writer = null;
        try {
            writer = WebUtils.toHttp(response).getWriter();
        } catch (IOException ignored) {
        }
        assert writer !=null;
        // 这里做token验证处理，在验证器中验证token
        String message = e.getMessage();
        // 令牌过期
        if (expiredJwt.equals(message)) {
            String jwt = JsonWebTokenUtil.parseJwtPayload(token.getCredentials().toString());
            JwtAccount jwtAccount = JSONUtil.toBean(jwt, JwtAccount.class);
            String s = redisTemplate.opsForValue().get("JWT-SESSION-" + IpUtil.getIpFromRequest((HttpServletRequest) request).toUpperCase() + jwtAccount.getSub());
            if (s != null) {
                // 重新申请新的JWT
                String newJwt = JsonWebTokenUtil.createToken(UUID.randomUUID().toString(), jwtAccount.getSub(),
                        "token-server", jwtAccount.getPassword(), properties.getExpire(), SignatureAlgorithm.HS512);
                // 将签发的JWT存储到Redis： {JWT-SESSION-{appID} , jwt}
                redisTemplate.opsForValue().set("JWT-SESSION-" + IpUtil.getIpFromRequest((HttpServletRequest) request) + "_" + jwtAccount.getSub(), newJwt, properties.getExpire() << 1, TimeUnit.SECONDS);
                writer.print(JSON.toJSONString(AjaxResult.success("刷新令牌", 1006, newJwt)));
            } else {
                writer.print(JSON.toJSONString(AjaxResult.success("令牌无效！", 1008, null)));
            }
            writer.flush();
            return false;
        }
        writer.print(JSON.toJSONString(AjaxResult.success(message, 1008, null)));
        writer.flush();
        return false;
    }

}

```

配置`config`

`shiroFilter`管理

```java
package com.luoyx.vjsb.authority.shiro.filter;

import com.luoyx.vjsb.common.holder.SpringContextHolder;
import com.luoyx.vjsb.common.properties.VjsbProperties;
import lombok.extern.slf4j.Slf4j;
import org.apache.shiro.spring.web.ShiroFilterFactoryBean;
import org.apache.shiro.web.filter.mgt.DefaultFilterChainManager;
import org.apache.shiro.web.filter.mgt.PathMatchingFilterChainResolver;
import org.apache.shiro.web.servlet.AbstractShiroFilter;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import javax.annotation.Resource;
import javax.servlet.Filter;
import java.util.*;

/**
* <p>
* Shiro Filter 管理器
* </p>
*
* @author luoyuanxiang <p>luoyuanxiang.github.io</p>
* @since 2020/3/20 11:00
  */
  @Slf4j
  @Component
  public class ShiroFilterChainManager {

  @Resource
  private StringRedisTemplate stringRedisTemplate;

  @Resource
  private VjsbProperties vjsbProperties;


    /**
     * 初始化获取过滤链
     *
     * @return java.util.Map<java.lang.String, javax.servlet.Filter>
     */
    public Map<String, Filter> initGetFilters() {

        Map<String, Filter> filters = new LinkedHashMap<>();
        Oauth2Filter jwtFilter = new Oauth2Filter();
        jwtFilter.setRedisTemplate(stringRedisTemplate);
        jwtFilter.setProperties(vjsbProperties);
        filters.put("oauth2", jwtFilter);

        return filters;
    }

    /**
     * 初始化获取过滤链规则
     *
     * @return java.util.Map<java.lang.String, java.lang.String>
     */
    public Map<String, String> initGetFilterChain() {

        Map<String, String> filterChain = new LinkedHashMap<>();
        // -------------anon 默认过滤器忽略的URL
        List<String> defaultAnon = Arrays.asList("/css/**", "/js/**", "/login");
        defaultAnon.forEach(ignored -> filterChain.put(ignored, "anon"));
        // -------------auth 默认需要认证过滤器的URL 走auth--PasswordFilter
        List<String> defaultAuth = Collections.singletonList("/**");
        defaultAuth.forEach(auth -> filterChain.put(auth, "oauth2"));

        return filterChain;
    }

    /**
     * 动态重新加载过滤链规则
     */
    public void reloadFilterChain() {
        ShiroFilterFactoryBean shiroFilterFactoryBean = SpringContextHolder.getBean(ShiroFilterFactoryBean.class);
        AbstractShiroFilter abstractShiroFilter = null;
        try {
            abstractShiroFilter = (AbstractShiroFilter) shiroFilterFactoryBean.getObject();
            assert abstractShiroFilter != null;
            PathMatchingFilterChainResolver filterChainResolver = (PathMatchingFilterChainResolver) abstractShiroFilter.getFilterChainResolver();
            DefaultFilterChainManager filterChainManager = (DefaultFilterChainManager) filterChainResolver.getFilterChainManager();
            filterChainManager.getFilterChains().clear();
            shiroFilterFactoryBean.getFilterChainDefinitionMap().clear();
            shiroFilterFactoryBean.setFilterChainDefinitionMap(this.initGetFilterChain());
            shiroFilterFactoryBean.getFilterChainDefinitionMap().forEach(filterChainManager::createChain);
        } catch (Exception e) {
            log.error(e.getMessage(), e);
        }
    }
}

```

`shiro`配置类

```java
package com.luoyx.vjsb.authority.shiro.config;

import com.luoyx.vjsb.authority.shiro.filter.ShiroFilterChainManager;
import com.luoyx.vjsb.authority.shiro.realm.Oauth2Realm;
import lombok.extern.slf4j.Slf4j;
import org.apache.shiro.SecurityUtils;
import org.apache.shiro.mgt.DefaultSessionStorageEvaluator;
import org.apache.shiro.mgt.DefaultSubjectDAO;
import org.apache.shiro.mgt.SecurityManager;
import org.apache.shiro.session.mgt.DefaultSessionManager;
import org.apache.shiro.spring.web.ShiroFilterFactoryBean;
import org.apache.shiro.web.mgt.DefaultWebSecurityManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
* <p>
* shiro 权限配置
* </p>
*
* @author luoyuanxiang <p>luoyuanxiang.github.io</p>
* @since 2020/3/19 15:17
  */
  @Slf4j
  @Configuration
  public class ShiroConfiguration {

  @Bean
  public ShiroFilterFactoryBean shiroFilterFactoryBean(SecurityManager securityManager, ShiroFilterChainManager filterChainManager) {
  ShiroFilterFactoryBean shiroFilterFactoryBean = new ShiroFilterFactoryBean();
  shiroFilterFactoryBean.setSecurityManager(securityManager);
  shiroFilterFactoryBean.setFilters(filterChainManager.initGetFilters());
  shiroFilterFactoryBean.setFilterChainDefinitionMap(filterChainManager.initGetFilterChain());
  return shiroFilterFactoryBean;
  }

  @Bean
  public SecurityManager securityManager() {
  DefaultWebSecurityManager securityManager = new DefaultWebSecurityManager();
  securityManager.setRealm(jwtRealm());

       log.info("设置sessionManager禁用掉会话调度器");
       securityManager.setSessionManager(sessionManager());

       // 无状态subjectFactory设置
       DefaultSessionStorageEvaluator evaluator = (DefaultSessionStorageEvaluator) ((DefaultSubjectDAO) securityManager.getSubjectDAO()).getSessionStorageEvaluator();
       evaluator.setSessionStorageEnabled(Boolean.FALSE);
       StatelessDefaultSubjectFactory subjectFactory = new StatelessDefaultSubjectFactory();
       securityManager.setSubjectFactory(subjectFactory);

       SecurityUtils.setSecurityManager(securityManager);

       return securityManager;
  }

  @Bean
  public Oauth2Realm jwtRealm() {
  return new Oauth2Realm();
  }

  /**
    * session管理器
    * sessionManager通过sessionValidationSchedulerEnabled禁用掉会话调度器，
    * 因为我们禁用掉了会话，所以没必要再定期过期会话了。
    *
    * @return 1
      */
      @Bean
      public DefaultSessionManager sessionManager() {
      DefaultSessionManager sessionManager = new DefaultSessionManager();
      sessionManager.setSessionValidationSchedulerEnabled(Boolean.FALSE);
      return sessionManager;
      }
      }

StatelessDefaultSubjectFactory

package com.luoyx.vjsb.authority.shiro.config;

import org.apache.shiro.subject.Subject;
import org.apache.shiro.subject.SubjectContext;
import org.apache.shiro.web.mgt.DefaultWebSubjectFactory;

/**
* <p>
*
* </p>
*
* @author luoyuanxiang <p>luoyuanxiang.github.io</p>
* @since 2020/3/20 16:24
  */
  public class StatelessDefaultSubjectFactory extends DefaultWebSubjectFactory {

  @Override
  public Subject createSubject(SubjectContext context) {
  //不创建session
  context.setSessionCreationEnabled(false);
  return super.createSubject(context);
  }
  }

```

`token`工具生成类

```java
package com.luoyx.vjsb.authority.util;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.luoyx.vjsb.authority.vo.JwtAccount;
import io.jsonwebtoken.*;
import io.jsonwebtoken.impl.DefaultHeader;
import io.jsonwebtoken.impl.DefaultJwsHeader;
import io.jsonwebtoken.impl.TextCodec;
import io.jsonwebtoken.impl.compression.DefaultCompressionCodecResolver;
import io.jsonwebtoken.lang.Assert;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import javax.xml.bind.DatatypeConverter;
import java.io.IOException;
import java.util.*;

/**
* <p>
* token生成器
* </p>
*
* @author luoyuanxiang <p>luoyuanxiang.github.io</p>
* @since 2020/3/19 15:37
  */
  public class JsonWebTokenUtil {


    public static final String SECRET_KEY = "?::4343fdf4fdf6cvf):";
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final int COUNT_2 = 2;

    private static CompressionCodecResolver codecResolver = new DefaultCompressionCodecResolver();

    private JsonWebTokenUtil() {

    }

    /**
     * json web token 签发
     *
     * @param id          令牌ID
     * @param subject     用户ID
     * @param issuer      签发人
     * @param period      有效时间(秒)
     * @param password    用户密码
     * @param algorithm   加密算法
     * @return java.lang.String
     */
    public static String createToken(String id, String subject, String issuer, String password, Long period, SignatureAlgorithm algorithm) {
        // 当前时间戳
        long currentTimeMillis = System.currentTimeMillis();
        // 秘钥
        byte[] secreKeyBytes = DatatypeConverter.parseBase64Binary(SECRET_KEY);
        JwtBuilder jwtBuilder = Jwts.builder();
        Optional.ofNullable(id)
                .ifPresent(i-> {
                    jwtBuilder.setId(id);
                });
        if (!StringUtils.isEmpty(id)) {
            jwtBuilder.setId(id);
        }
        if (!StringUtils.isEmpty(subject)) {
            jwtBuilder.setSubject(subject);
        }
        if (!StringUtils.isEmpty(issuer)) {
            jwtBuilder.setIssuer(issuer);
        }
        if (!StringUtils.isEmpty(password)) {
            jwtBuilder.claim("password", password);
        }
        // 设置签发时间
        jwtBuilder.setIssuedAt(new Date(currentTimeMillis));
        // 设置到期时间
        if (null != period) {
            jwtBuilder.setExpiration(new Date(currentTimeMillis + period * 1000));
        }
        // 压缩，可选GZIP
        jwtBuilder.compressWith(CompressionCodecs.DEFLATE);
        // 加密设置
        jwtBuilder.signWith(algorithm, secreKeyBytes);

        return jwtBuilder.compact();
    }

    /**
     * 解析JWT的Payload
     */
    public static String parseJwtPayload(String jwt) {
        Assert.hasText(jwt, "JWT String argument cannot be null or empty.");
        String base64UrlEncodedHeader = null;
        String base64UrlEncodedPayload = null;
        String base64UrlEncodedDigest = null;
        int delimiterCount = 0;
        StringBuilder sb = new StringBuilder(128);
        for (char c : jwt.toCharArray()) {
            if (c == '.') {
                CharSequence tokenSeq = io.jsonwebtoken.lang.Strings.clean(sb);
                String token = tokenSeq != null ? tokenSeq.toString() : null;

                if (delimiterCount == 0) {
                    base64UrlEncodedHeader = token;
                } else if (delimiterCount == 1) {
                    base64UrlEncodedPayload = token;
                }

                delimiterCount++;
                sb.setLength(0);
            } else {
                sb.append(c);
            }
        }
        if (delimiterCount != COUNT_2) {
            String msg = "JWT strings must contain exactly 2 period characters. Found: " + delimiterCount;
            throw new MalformedJwtException(msg);
        }
        if (sb.length() > 0) {
            base64UrlEncodedDigest = sb.toString();
        }
        if (base64UrlEncodedPayload == null) {
            throw new MalformedJwtException("JWT string '" + jwt + "' is missing a body/payload.");
        }
        // =============== Header =================
        Header header = null;
        CompressionCodec compressionCodec = null;
        if (base64UrlEncodedHeader != null) {
            String origValue = TextCodec.BASE64URL.decodeToString(base64UrlEncodedHeader);
            Map<String, Object> m = readValue(origValue);
            if (base64UrlEncodedDigest != null) {
                header = new DefaultJwsHeader(m);
            } else {
                header = new DefaultHeader(m);
            }
            compressionCodec = codecResolver.resolveCompressionCodec(header);
        }
        // =============== Body =================
        String payload;
        if (compressionCodec != null) {
            byte[] decompressed = compressionCodec.decompress(TextCodec.BASE64URL.decode(base64UrlEncodedPayload));
            payload = new String(decompressed, io.jsonwebtoken.lang.Strings.UTF_8);
        } else {
            payload = TextCodec.BASE64URL.decodeToString(base64UrlEncodedPayload);
        }
        return payload;
    }

    /**
     * 验签JWT
     *
     * @param jwt    json web token
     * @param appKey key
     * @return JwtAccount
     * @throws ExpiredJwtException      异常
     * @throws UnsupportedJwtException  异常
     * @throws MalformedJwtException    异常
     * @throws SignatureException       异常
     * @throws IllegalArgumentException 异常
     */
    public static JwtAccount parseJwt(String jwt, String appKey) throws ExpiredJwtException, UnsupportedJwtException, MalformedJwtException, SignatureException, IllegalArgumentException {
        Claims claims = Jwts.parser()
                .setSigningKey(DatatypeConverter.parseBase64Binary(appKey))
                .parseClaimsJws(jwt)
                .getBody();
        JwtAccount jwtAccount = new JwtAccount();
        // 令牌ID
        jwtAccount.setJti(claims.getId())
                // 客户标识
                .setSub(claims.getSubject())
                // 签发者
                .setIss(claims.getIssuer())
                // 签发时间
                .setIat(claims.getIssuedAt().getTime())
                .setExp(claims.getExpiration().getTime())
                // 密码
                .setPassword(claims.get("password", String.class));
        return jwtAccount;
    }


    /**
     * description 从json数据中读取格式化map
     *
     * @param val 1
     * @return java.util.Map<java.lang.String, java.lang.Object>
     */
    @SuppressWarnings("unchecked")
    public static Map<String, Object> readValue(String val) {
        try {
            return MAPPER.readValue(val, Map.class);
        } catch (IOException e) {
            throw new MalformedJwtException("Unable to read JSON value: " + val, e);
        }
    }

    /**
     * 分割字符串进SET
     */
    @SuppressWarnings("unchecked")
    public static Set<String> split(String str) {

        Set<String> set = new HashSet<>();
        if (StringUtils.isEmpty(str)) {
            return set;
        }
        set.addAll(CollectionUtils.arrayToList(str.split(",")));
        return set;
    }
}

```

到此项目差不多搞定

项目源码：[源码](https://gitee.com/luoyuanxiang/vjsb)好的，我们继续完善这个基于 Shiro + JWT 的认证授权系统。接下来将补充核心的领域（Realm）实现、登录控制器以及一些必要的配置和工具类。

---

### 三、核心实现

#### 1. 自定义 Realm（`Oauth2Realm`）

Realm 是 Shiro 的核心组件，用于处理认证（登录）和授权（权限检查）。我们需要自定义一个 Realm 来处理 JWT Token。

```java
package com.luoyx.vjsb.authority.shiro.realm;

import com.luoyx.vjsb.authority.shiro.token.Oauth2Token;
import com.luoyx.vjsb.authority.util.JsonWebTokenUtil;
import com.luoyx.vjsb.authority.vo.JwtAccount;
import com.luoyx.vjsb.common.properties.VjsbProperties;
import lombok.extern.slf4j.Slf4j;
import org.apache.shiro.authc.AuthenticationException;
import org.apache.shiro.authc.AuthenticationInfo;
import org.apache.shiro.authc.AuthenticationToken;
import org.apache.shiro.authc.SimpleAuthenticationInfo;
import org.apache.shiro.authz.AuthorizationInfo;
import org.apache.shiro.authz.SimpleAuthorizationInfo;
import org.apache.shiro.realm.AuthorizingRealm;
import org.apache.shiro.subject.PrincipalCollection;
import org.springframework.stereotype.Component;

import javax.annotation.Resource;

/**
 * <p>
 * 自定义 Realm，处理 JWT Token 的认证与授权
 * </p>
 * @author luoyuanxiang
 */
@Slf4j
@Component
public class Oauth2Realm extends AuthorizingRealm {

    @Resource
    private VjsbProperties vjsbProperties;

    /**
     * 限定此 Realm 只支持我们自定义的 Oauth2Token 类型
     */
    @Override
    public boolean supports(AuthenticationToken token) {
        return token instanceof Oauth2Token;
    }

    /**
     * 授权方法：当用户访问需要权限的接口时，会调用此方法
     * 由于我们的权限信息也存储在 JWT 中，可以直接解析，无需额外查询数据库（除非需要实时权限）
     */
    @Override
    protected AuthorizationInfo doGetAuthorizationInfo(PrincipalCollection principals) {
        // 从 principals 中获取主身份信息（即之前认证时存入的 JWT 字符串）
        String jwt = (String) principals.getPrimaryPrincipal();
        JwtAccount jwtAccount = null;
        try {
            // 解析 JWT，获取负载中的信息
            jwtAccount = JsonWebTokenUtil.parseJwt(jwt, JsonWebTokenUtil.SECRET_KEY);
        } catch (Exception e) {
            log.error("JWT 解析失败，无法进行授权", e);
            throw new AuthenticationException("Token 无效", e);
        }

        SimpleAuthorizationInfo authorizationInfo = new SimpleAuthorizationInfo();
        // 这里假设 JWT 的 payload 中包含了角色和权限信息（例如 roles: "admin,user", permissions: "user:read,user:write"）
        // 实际项目中可能需要从数据库实时查询用户最新权限
        // authorizationInfo.addRoles(jwtAccount.getRoles());
        // authorizationInfo.addStringPermissions(jwtAccount.getPermissions());
        
        // 示例：添加一个固定权限（实际应根据 jwtAccount 中的信息动态添加）
        authorizationInfo.addRole("admin");
        authorizationInfo.addStringPermission("user:read");
        
        return authorizationInfo;
    }

    /**
     * 认证方法：在登录时调用，验证 token 的有效性
     */
    @Override
    protected AuthenticationInfo doGetAuthenticationInfo(AuthenticationToken token) throws AuthenticationException {
        String jwtToken = (String) token.getCredentials();
        if (jwtToken == null) {
            throw new AuthenticationException("Token 不能为空");
        }

        // 校验 JWT 的有效性（是否被篡改、是否过期）
        JwtAccount jwtAccount;
        try {
            jwtAccount = JsonWebTokenUtil.parseJwt(jwtToken, JsonWebTokenUtil.SECRET_KEY);
        } catch (Exception e) {
            log.error("JWT 校验失败", e);
            // 根据异常类型抛出不同的 AuthenticationException
            if (e instanceof ExpiredJwtException) {
                throw new AuthenticationException("expiredJwt"); // 这个字符串会在过滤器中捕获用于刷新 token
            } else {
                throw new AuthenticationException("Token 无效或已过期");
            }
        }

        // 这里可以添加额外的校验，例如检查用户是否被锁定、是否被删除等（需要查询数据库）
        // if (!userService.isUserActive(jwtAccount.getSub())) {
        //     throw new AuthenticationException("用户已被禁用");
        // }

        // 认证成功，返回一个 AuthenticationInfo 对象，Shiro 会将其保存到 PrincipalCollection 中
        return new SimpleAuthenticationInfo(
                jwtToken,    // Principal: 身份标识，这里我们直接使用 JWT 字符串本身
                jwtToken,    // Credentials: 凭证，同样为 JWT
                getName()    // Realm Name
        );
    }
}
```

#### 2. 登录控制器（`LoginController`）

提供一个简单的登录接口，验证用户名密码后签发 JWT。

```java
package com.luoyx.vjsb.authority.controller;

import com.luoyx.vjsb.authority.util.JsonWebTokenUtil;
import com.luoyx.vjsb.authority.vo.JwtAccount;
import com.luoyx.vjsb.common.util.AjaxResult;
import com.luoyx.vjsb.common.util.IpUtil;
import io.jsonwebtoken.SignatureAlgorithm;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import javax.annotation.Resource;
import javax.servlet.http.HttpServletRequest;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * <p>
 * 登录控制器
 * </p>
 * @author luoyuanxiang
 */
@Slf4j
@RestController
public class LoginController {

    @Resource
    private StringRedisTemplate stringRedisTemplate;

    @Resource
    private com.luoyx.vjsb.common.properties.VjsbProperties vjsbProperties;

    /**
     * 用户登录接口
     */
    @PostMapping("/login")
    public AjaxResult login(@RequestParam String username, 
                           @RequestParam String password,
                           HttpServletRequest request) {
        // 1. 校验用户名和密码 (这里省略了具体的校验逻辑，实际应查询数据库)
        // User user = userService.findByUsernameAndPassword(username, password);
        // if (user == null) {
        //     return AjaxResult.error("用户名或密码错误");
        // }

        // 模拟一个用户ID
        String userId = "10001";

        // 2. 生成 JWT
        String jwt = JsonWebTokenUtil.createToken(
                UUID.randomUUID().toString(), // JWT ID
                userId,                      // Subject (通常为用户唯一标识)
                "vjsb-server",               // Issuer
                password,                    // 可以将密码哈希后存入，但切勿明文存储敏感信息
                vjsbProperties.getExpire(),  // 过期时间（秒）
                SignatureAlgorithm.HS512     // 签名算法
        );

        // 3. 将 JWT 存储到 Redis（用于实现 token 刷新或强制失效机制）
        String redisKey = "JWT-SESSION-" + IpUtil.getIpFromRequest(request) + "_" + userId;
        stringRedisTemplate.opsForValue().set(
                redisKey, 
                jwt, 
                vjsbProperties.getExpire() * 2, // Redis 中的过期时间稍长于 JWT 过期时间
                TimeUnit.SECONDS
        );

        // 4. 返回 JWT 给客户端
        return AjaxResult.success("登录成功", jwt);
    }

    /**
     * 用户登出接口（可选）
     * 由于 JWT 是无状态的，服务器无法直接使其失效。
     * 常见的解决方案是在 Redis 中维护一个黑名单，或者使客户端主动丢弃 token。
     * 这里演示通过 Redis 黑名单实现：
     */
    @PostMapping("/logout")
    public AjaxResult logout(HttpServletRequest request) {
        String token = request.getHeader("Authorization");
        if (token != null) {
            try {
                // 解析 token 获取用户信息
                JwtAccount jwtAccount = JsonWebTokenUtil.parseJwt(token, JsonWebTokenUtil.SECRET_KEY);
                String userId = jwtAccount.getSub();
                // 将 token 加入黑名单（或直接删除 Redis 中的有效 token 记录）
                String redisKey = "JWT-BLACKLIST-" + token;
                stringRedisTemplate.opsForValue().set(redisKey, "logout", jwtAccount.getExp() - System.currentTimeMillis(), TimeUnit.MILLISECONDS);
                // 删除原有的 token 记录（如果存在）
                stringRedisTemplate.delete("JWT-SESSION-" + IpUtil.getIpFromRequest(request) + "_" + userId);
                return AjaxResult.success("登出成功");
            } catch (Exception e) {
                log.warn("登出时解析 token 失败", e);
            }
        }
        return AjaxResult.error("登出失败");
    }
}
```

#### 3. 全局异常处理（可选但推荐）

统一处理 Shiro 抛出的认证授权异常，返回友好的 JSON 格式错误信息。

```java
package com.luoyx.vjsb.common.handler;

import com.luoyx.vjsb.common.util.AjaxResult;
import lombok.extern.slf4j.Slf4j;
import org.apache.shiro.authc.AuthenticationException;
import org.apache.shiro.authz.AuthorizationException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * <p>
 * 全局异常处理器
 * </p>
 * @author luoyuanxiang
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * 处理认证失败异常（未登录、token无效等）
     */
    @ExceptionHandler(AuthenticationException.class)
    public AjaxResult handleAuthenticationException(AuthenticationException e) {
        log.warn("认证失败: {}", e.getMessage());
        return AjaxResult.error(1007, "认证失败: " + e.getMessage());
    }

    /**
     * 处理授权失败异常（无权限访问）
     */
    @ExceptionHandler(AuthorizationException.class)
    public AjaxResult handleAuthorizationException(AuthorizationException e) {
        log.warn("授权失败: {}", e.getMessage());
        return AjaxResult.error(1008, "无权限访问");
    }

    /**
     * 处理其他异常
     */
    @ExceptionHandler(Exception.class)
    public AjaxResult handleException(Exception e) {
        log.error("系统异常: ", e);
        return AjaxResult.error(500, "系统内部错误");
    }
}
```

---

### 四、总结与使用

至此，一个基于 **Spring Boot + Shiro + JWT + Redis** 的无状态分布式认证授权系统就搭建完成了。

**核心流程总结：**

1.  **登录 (`/login`)**：用户提供凭证，服务器校验通过后，生成 JWT 并返回给客户端，同时在 Redis 中存储一份（用于后续刷新和黑名单机制）。
2.  **访问API**：客户端在请求头 `Authorization` 中携带 JWT。
3.  **过滤 (`Oauth2Filter`)**：自定义过滤器拦截请求，提取 JWT，并调用 `subject.login(token)` 发起认证。
4.  **认证 (`Oauth2Realm`)**：Realm 验证 JWT 的有效性（签名、过期时间）。
5.  **授权 (`Oauth2Realm`)**：认证通过后，Realm 根据 JWT 中的信息（或查询数据库）为用户授予角色和权限。
6.  **权限校验**：Shiro 的注解（如 `@RequiresRoles`, `@RequiresPermissions`）或 URL 配置会拦截无权限的访问。
7.  **登出 (`/logout`)**（可选）：将 JWT 加入黑名单或删除 Redis 中的有效记录，使 token 提前失效。

**如何使用：**

1.  在需要权限的控制器方法上添加 Shiro 注解：
    ```java
    @RequiresPermissions("user:read")
    @GetMapping("/user/info")
    public AjaxResult getUserInfo() {
        // ...
    }
    ```
2.  前端在请求需要认证的 API 时，在 Header 中设置：
    ```
    Authorization: your_jwt_token_string
    ```

**注意事项：**

*   **JWT 安全性**：确保使用强密钥（`SECRET_KEY`）且妥善保管。考虑定期更换密钥。
*   **敏感信息**：不要在 JWT Payload 中存储敏感信息（如密码明文），因为它是可解码的。
*   **Token 失效**：由于 JWT 的无状态性，实现即时失效较复杂。文中提供了基于 Redis 黑名单的示例，但会增加系统状态性。请根据业务需求权衡。
*   **性能**：如果每次授权都需要查询数据库获取实时权限，可能会影响性能。可以考虑将权限信息也放入 JWT，但牺牲了实时性。

项目源码已提供，可以根据实际业务需求进行进一步的调整和优化，例如集成数据库用户查询、更复杂的权限