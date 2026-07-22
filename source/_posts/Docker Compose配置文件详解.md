---
title: Docker Compose配置文件详解
description: 本文详细解析Docker Compose配置文件的结构与服务配置项，涵盖版本定义、服务部署、网络设置及数据卷配置，并通过具体示例展示各配置参数的用法与注意事项。
tags:
- docker
- docker-compose
- 基础
categories:
- 开发笔记
cover: https://cdn.luoyuanxiang.top/cover-docker-compose-config.webp
date: '2025-09-04 14:57:00'
recommend: true
---

### Compose配置文件结构

```yaml
version: "3.8"
services:

  redis:
    image: redis:alpine
    ports:
      - "6379"
    networks:
      - frontend
    deploy:
      replicas: 2
      update_config:
        parallelism: 2
        delay: 10s
      restart_policy:
        condition: on-failure

  db:
    image: postgres:9.4
    volumes:
      - db-data:/var/lib/postgresql/data
    networks:
      - backend
    deploy:
      placement:
        constraints:
          - "node.role==manager"

  vote:
    image: dockersamples/examplevotingapp_vote:before
    ports:
      - "5000:80"
    networks:
      - frontend
    depends_on:
      - redis
    deploy:
      replicas: 2
      update_config:
        parallelism: 2
      restart_policy:
        condition: on-failure

  result:
    image: dockersamples/examplevotingapp_result:before
    ports:
      - "5001:80"
    networks:
      - backend
    depends_on:
      - db
    deploy:
      replicas: 1
      update_config:
        parallelism: 2
        delay: 10s
      restart_policy:
        condition: on-failure

  worker:
    image: dockersamples/examplevotingapp_worker
    networks:
      - frontend
      - backend
    deploy:
      mode: replicated
      replicas: 1
      labels: [APP=VOTING]
      restart_policy:
        condition: on-failure
        delay: 10s
        max_attempts: 3
        window: 120s
      placement:
        constraints:
          - "node.role==manager"

  visualizer:
    image: dockersamples/visualizer:stable
    ports:
      - "8080:8080"
    stop_grace_period: 1m30s
    volumes:
      - "/var/run/docker.sock:/var/run/docker.sock"
    deploy:
      placement:
        constraints:
          - "node.role==manager"

networks:
  frontend:
  backend:

volumes:
  db-data:


```

顶层的`version`、`services`、`networks`和`volumes`将`Compose`配置文件分为四个部分，其中`version`指定`Compose`配置文件的版本，`services`定义服务，`networks`定义网络，`volumes`定义数据卷。

### 服务配置

服务定义了该服务启动的每个容器的配置，就像将命令行参数传递给docker run一样。比如以下配置：

```yaml
services:
  redis:
    image: redis

```

services下的redis是用户自定义的服务名称，redis下的image只是众多服务配置项中的其中一个，意思是指定镜像名称或id。下面就对服务的相关配置项进行一个总结。

#### 1\. build

在构建时应用的配置项。一般直接指定Dockerfile所在文件夹路径，可以是绝对路径，或者相对于Compose配置文件的路径。可以指定为包含构建上下文（context）路径的字符串。例如：

```yaml
version: "3.8"
services:
  webapp:
    build: ./dir

```

也可以使用context指定上下文路径，使用dockerfile基于上下文路径指定Dockerfile文件，使用args指定构建参数。例如：

```yaml
version: "3.8"
services:
  webapp:
    build:
      context: ./dir
      dockerfile: Dockerfile-alternate
      args:
        buildno: 1

```

如果同时指定了build和image。例如：

```yaml
build: ./dir
image: webapp:tag

```

Compose会在./dir目录下构建一个名为webapp，标签为tag的镜像。

使用docker stack deploy时的注意事项：在swarm mode下部署堆栈时，build配置项被忽略。因为docker stack命令不会在部署之前构建镜像。

##### (1)context

指定包含Dockerfile的目录路径或git仓库url。该目录是发送给Docker守护进程（Daemon）的构建上下文（context）。当配置的值是相对路径时，它将被解释为相对于Compose配置文件的路径。例如：

```yaml
build:
  context: ./dir

```

指定上下文为Compose配置文件目录下的dir目录。也可以这样写：

```yaml
build: dir

```

##### (2)dockerfile

指定Dockerfile文件。Compose会使用指定的Dockerfile文件构建镜像，但必须要指定构建上下文路径。例如：

```yaml
build:
  context: .
  dockerfile: Dockerfile-alternate

```

Compose会使用Compose配置文件所在目录下名为Dockerfile-alternate的Dockerfile文件构建镜像。

##### (3)args

添加构建参数，这些只能在构建过程中访问的环境变量。首先在Dockerfile文件中指定参数：

```dockerfile
ARG buildno
ARG gitcommithash

RUN echo "Build number: $buildno"
RUN echo "Based on commit: $gitcommithash"

```

然后build中指定参数，以下两种写法都可以：

```yaml
build:
  context: .
  args:
    buildno: 1
    gitcommithash: cdc3b19

```

```yaml
build:
  context: .
  args:
    - buildno=1
    - gitcommithash=cdc3b19

```

这时构建过程中使用的参数的值为args指定的值。在指定构建参数时也可以不指定值，在这种情况下，构建过程中使用的参数的值为运行Compose的环境中的值。例如：

```yaml
args:
  - buildno
  - gitcommithash

```

使用布尔值时的注意事项：YMAL中布尔类型的值（“true”、“false”、“yes”、“no”、“on”、“off”）必须用引号引起来，以便解析器将它们解释为字符串。

##### (4)cache\_from

在3.2版的配置文件格式中加入

指定缓存解析镜像列表。例如：

```yaml
build:
    context: .
    cache_from:
        - alpine:latest
        - corp/web_app:3.14

```

##### (5)labels

在3.3版的配置文件格式中加入

将元数据以标签的形式添加到生成的镜像中。可以使用数组或字典两种格式。推荐使用反向DNS写法以避免和其他应用的标签冲突。例如：

```yaml
build:
  context: .
  labels:
    com.example.description: "Accounting webapp"
    com.example.department: "Finance"
    com.example.label-with-empty-value: ""

```

```yaml
build:
  context: .
  labels:
    - "com.example.description=Accounting webapp"
    - "com.example.department=Finance"
    - "com.example.label-with-empty-value"

```

##### (6)network

在3.4版的配置文件格式中加入

设置容器网络连接以获取构建过程中的RUN指令。例如：

```yaml
build:
  context: .
  network: custom_network_1

```

设置为none可以在构建期间禁用网络连接。例如：

```yaml
build:
  context: .
  network: none

```

(7)shm\_size  

在3.5版的配置文件格式中加入

指定容器的/dev/shm分区大小。指定的值为表示字节数的整数值或表示字节值的字符串。例如：

```yaml
build:
  context: .
  shm_size: 10000000

```

```yaml
build:
  context: .
  shm_size: '2gb'

```

##### (8)target

在3.4版的配置文件格式中加入

指定在Dockerfile中定义的构建阶段，即镜像只构建到指定阶段就停止构建。例如：

```yaml
build:
  context: .
  target: prod

```

指定构建阶段为prod，即镜像只构建到prod阶段，prod阶段之后的内容不会被构建。

#### 2.cap\_add、cap\_drop

添加或删除容器内核能力（capability）。完整的capability列表可查看man 7 capabilities。例如，让容器拥有所有内核能力：

```yaml
cap_add:
  - ALL

```

例如，删除NET\_ADMIN和SYS\_ADMIN能力：

```yaml
cap_drop:
  - NET_ADMIN
  - SYS_ADMIN

```

使用docker stack deploy时的注意事项：在swarm mode下部署堆栈时，cap\_add和cap\_drop配置项将被忽略。

#### 3.cgroup\_parent

为容器指定一个可选的父控制组。例如：

```yaml
cgroup_parent: m-executor-abcd

```

使用docker stack deploy时的注意事项：在swarm mode下部署堆栈时，cgroup\_parent配置项将被忽略。

#### 4.command

覆盖容器启动后默认执行的命令。可以写成字符串形式。例如：

```yaml
command: bundle exec thin -p 3000

```

也可以写成JSON数组形式。例如：

```yaml
command: ["bundle", "exec", "thin", "-p", "3000"]

```

#### 5.configs

在3.3版的配置文件格式中加入

为每个服务授予对配置（configs）的访问权限。支持short和long两种格式的语法。更多configs信息，参考configs。

注意：该配置（config）必须已存在或者在堆栈文件顶层configs配置项中定义，否则堆栈部署将失败。

short语法仅指定config名称来授予容器访问config的权限并将其挂载到容器的/<config\_name>上。source名称和目标挂载点都设置为config名称。例如以下示例，授予了redis服务对configs的my\_config和my\_other\_config的访问权限，其中my\_config的值设置到文件./my\_config.txt的内容中，my\_other\_config定义为外部资源，这意味着它已经在Docker中通过运行docker config create命令或其他堆栈部署进行定义，如果外部config不存在，堆栈部署将会失败并显示config not found错误：

```yaml
version: "3.8"
services:
  redis:
    image: redis:latest
    deploy:
      replicas: 1
    configs:
      - my_config
      - my_other_config
configs:
  my_config:
    file: ./my_config.txt
  my_other_config:
    external: true

```

long语法提供了在服务的任务容器内如何创建config的更多粒度：

-   source：Docker中存在的config名称。
    
-   target：指定要挂载到服务的任务容器的文件的路径加名称。如果未指定，默认为/。
    
-   uid和gid：指定服务的任务容器所拥有的该文件的UID或GID。如果在LInux中未指定，两者都默认为0。不支持Windows。
    
-   mode：以八进制表示法指定要挂载到服务的任务容器的文件权限。例如，0444代表可读。默认值就为0444。config内容已挂载到临时文件系统中，所以不可写，如果设置了可写位将被忽略。可以设置可执行位。如果不熟悉UNIX文件权限模式，可以使用权限计算器 。  
    例如以下示例，指定config名称为my\_config，授予redis服务对my\_config的访问权限，指定要挂载到redis服务的任务容器的路径加文件名称为/redis\_config，指定UID和GID均为103，指定要挂载到服务的任务容器的文件权限为0440（group-readable），但该redis服务没有访问my\_other\_config的权限：
    

```yaml
version: "3.8"
services:
  redis:
    image: redis:latest
    deploy:
      replicas: 1
    configs:
      - source: my_config
        target: /redis_config
        uid: '103'
        gid: '103'
        mode: 0440
configs:
  my_config:
    file: ./my_config.txt
  my_other_config:
    external: true

```

可以授予服务访问多个config的权限，并且可以混合long和short语法。定义config并不意味着授予服务对其的访问权限。

#### 6.container\_name

指定自定义容器的名称，而不是使用默认名称。例如：

```yaml
container_name: my-web-container

```

因为Docker容器的名称必须唯一，所以为一个服务指定了自定义容器名称后，该服务不能进行扩展。如果尝试为该服务扩容将会导致错误。

使用docker stack deploy时的注意事项：在swarm mode下部署堆栈时，container\_name配置项将被忽略。

#### 7.credential\_spec

在3.3版的配置文件格式中加入 在3.8或更高版本文件格式中支持将组托管服务帐户（GMSA）配置与Compose配置文件一起使用。

配置托管服务帐户的凭据规格（credential spec）。此选项仅用于使用Windows容器的服务。credential\_spec配置必须采用file://或registry://格式。使用file:时，引用的文件必须存在于Docker数据目录的CredentialSpecs子目录中，在Windows上，Docker数据目录默认为C:\\ProgramData\\Docker\\。以下示例从名为C:\\ProgramData\\Docker\\CredentialSpecs\\my-credential-spec.json的文件加载凭证规格：

```yaml
credential_spec:
  file: my-credential-spec.json

```

使用registry:时，将从守护进程主机上的Windows注册表中读取凭据规格。其注册表值必须位于HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Virtualization\\Containers\\CredentialSpecs。以下示例从注册表中名为my-credential-spec的值加载凭证规格：

```yaml
credential_spec:
  registry: my-credential-spec

```

为服务配置GMSA凭据规格时，只需用config指定凭据规格。例如：

```yaml
version: "3.8"
services:
  myservice:
    image: myimage:latest
    credential_spec:
      config: my_credential_spec

configs:
  my_credentials_spec:
    file: ./my-credential-spec.json

```

#### 8.depends\_on

指定服务之间的依赖关系，解决服务启动先后顺序问题。指定服务之间的依赖关系，将会导致以下行为：

-   docker-compose up以依赖顺序启动服务。
    
-   docker-compose up SERVICE会自动包含SERVICE的依赖项。
    
-   docker-compose stop以依赖顺序停止服务。  
    例如以下示例：
    

```yaml
version: "3.8"
services:
  web:
    build: .
    depends_on:
      - db
      - redis
  redis:
    image: redis
  db:
    image: postgres

```

启动时会先启动db和redis，最后才启动web。在使用docker-compose up web启动web时，也会启动db和redis，因为在web服务中指定了依赖关系。在停止时也在web之前先停止db和redis。

使用depends\_on时的注意事项：

1.  服务不会等待该服务所依赖的服务完全启动之后才启动。例如上例，web不会等到db和redis完全启动之后才启动。
2.  V3版不再支持的condition形式的depends\_on。
3.  V3版中，在swarm mode下部署堆栈时，depends\_on配置项将被忽略。

#### 9.deploy

在3版的配置文件格式中加入

指定部署和运行服务的相关配置。该配置仅在swarm mode下生效，并只能通过docker stack deploy命令部署，docker-compose up和docker-compose run命令将被忽略。例如：

```yaml
version: "3.8"
services:
  redis:
    image: redis:alpine
    deploy:
      replicas: 6
      placement:
        max_replicas_per_node: 1
      update_config:
        parallelism: 2
        delay: 10s
      restart_policy:
        condition: on-failure

```

deploy配置项中包含endpoint\_mode、labels、mode、placement、replicas、resources、restart\_policy、update\_config等子配置项。

##### (1)endpoint\_mode

在3.2版的配置文件格式中加入

为外部客户端连接到swarm指定服务发现方式：

-   endpoint\_mode: vip：Docker为服务分配了一个前端的虚拟IP，客户端通过该虚拟IP访问网络上的服务。Docker在客户端和服务的可用工作节点之间进行路由请求，而无须关系有多少节点正在参与该服务或这些节点的IP地址或者端口。这是默认设置。
    
-   endpoint\_mode: dnsrr：DNS轮询（DNSRR），Docker设置服务的DNS条目，以便对服务名称的DNS查询返回IP地址列表，并且客户端通过轮询的方式直接连接到其中之一。  
    例如：
    

```yaml
version: "3.8"
services:
  wordpress:
    image: wordpress
    ports:
      - "8080:80"
    deploy:
      mode: replicated
      replicas: 2
      endpoint_mode: vip

```