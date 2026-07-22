---
title: Docker容器操作与命令详解
description: 本文详细介绍了Docker容器的运行命令、参数解析及常用操作，包括MySQL和Redis的容器化部署示例，并涵盖了Docker镜像管理、容器生命周期操作及Dockerfile语法指南。
tags:
- docker
- 基础
categories:
- 开发笔记
cover: https://cdn.luoyuanxiang.top/cover-docker-commands.webp
date: '2025-09-04 14:57:00'
recommend: true
---

docker运行容器

```shell
docker run -it -v G:/docker/mysql/data:/var/lib/mysql -v G:/docker/mysql/config/my.cnf:/etc/mysql/my.cnf --restart=always --name mysql -e MYSQL_ROOT_PASSWORD=root -p 3306:3306 -d mysql


docker run -it -v /var/lib/mysql:/var/lib/mysql -v /etc/mysql/my.cnf:/etc/mysql/my.cnf --restart=always --name mysql -e MYSQL_ROOT_PASSWORD=root -p 3306:3306 -d mysql:5.7


docker run -it -d -p 6379:6379 -v G:/docker/redis/config/redis.conf:/usr/local/etc/redis/redis.conf -v G:/docker/redis/data:/data --name docker-redis docker.io/redis redis-server /usr/local/etc/redis/redis.conf --appendonly yes

命令解释

-p 6379:6379 : 将容器的6379端口映射到主机的6379端口

-v $PWD/docker/redis/conf:/etc/redis/redis.conf： 将主机中当前目录下的redis.conf映射成redis的启动配置文件
-v $PWD /docker/redis/data:/data： 将主机中当前目录下 /docker/reids/data挂载到容器的/data
redis-server /etc/redis/redis.conf：指定配置文件启动redis-server进程

--requirepass "123456" :指定链接redis-server的密码
--appendonly yes：开启数据持久化
Usage: docker run [OPTIONS] IMAGE [COMMAND] [ARG...]

-d, --detach=false         指定容器运行于前台还是后台，默认为false   
-i, --interactive=false   打开STDIN，用于控制台交互  
-t, --tty=false            分配tty设备，该可以支持终端登录，默认为false  
-u, --user=""              指定容器的用户  
-a, --attach=[]            标准输入输出流和错误信息（必须是以非docker run -d启动的容器）
-w, --workdir=""           指定容器的工作目录
-c, --cpu-shares=0        设置容器CPU权重，在CPU共享场景使用  
-e, --env=[]               指定环境变量，容器中可以使用该环境变量  
-m, --memory=""            指定容器的内存上限  
-P, --publish-all=false    指定容器暴露的端口  
-p, --publish=[]           指定容器暴露的端口
-h, --hostname=""          指定容器的主机名  
-v, --volume=[]            给容器挂载存储卷，挂载到容器的某个目录  
--volumes-from=[]          给容器挂载其他容器上的卷，挂载到容器的某个目录
--cap-add=[]               添加权限，权限清单详见：http://linux.die.net/man/7/capabilities  
--cap-drop=[]              删除权限，权限清单详见：http://linux.die.net/man/7/capabilities  
--cidfile=""               运行容器后，在指定文件中写入容器PID值，一种典型的监控系统用法  
--cpuset=""                设置容器可以使用哪些CPU，此参数可以用来容器独占CPU  
--device=[]                添加主机设备给容器，相当于设备直通  
--dns=[]                   指定容器的dns服务器  
--dns-search=[]            指定容器的dns搜索域名，写入到容器的/etc/resolv.conf文件  
--entrypoint=""            覆盖image的入口点  
--env-file=[]              指定环境变量文件，文件格式为每行一个环境变量  
--expose=[]                指定容器暴露的端口，即修改镜像的暴露端口  
--link=[]                  指定容器间的关联，使用其他容器的IP、env等信息  
--lxc-conf=[]              指定容器的配置文件，只有在指定--exec-driver=lxc时使用  
--name=""                  指定容器名字，后续可以通过名字进行容器管理，links特性需要使用名字  
--net="bridge"             容器网络设置:
bridge 使用docker daemon指定的网桥     
host     //容器使用主机的网络  
container:NAME_or_ID  >//使用其他容器的网路，共享IP和PORT等网络资源  
none 容器使用自己的网络（类似--net=bridge），但是不进行配置
--privileged=false         指定容器是否为特权容器，特权容器拥有所有的capabilities  
--restart="no"             指定容器停止后的重启策略:
no：容器退出时不重启  
on-failure：容器故障退出（返回值非零）时重启
always：容器退出时总是重启  
--rm=false                 指定容器停止后自动删除容器(不支持以docker run -d启动的容器)  
--sig-proxy=true           设置由代理接受并处理信号，但是SIGCHLD、SIGSTOP和SIGKILL不能被代理

```

docker补充命令

-   `docker start 容器名（容器ID也可以）`: 启动容器
    
-   `docker stop 容器名（容器ID也可以）`: 停止容器
    
-   `docker run 命令加 -d 参数`，docker 会将容器放到后台运行
    
-   `docker ps` 正在运行的容器
    
-   `docker logs --tail 10 -tf 容器名` 查看容器的日志文件,加-t是加上时间戳，f是跟踪某个容器的最新日志而不必读整个日志文件
    
-   `docker top` 容器名 查看容器内部运行的进程
    
-   `docker exec -d 容器名 touch /etc/new_config_file` 通过后台命令创建一个空文件
    
-   `docker run --restart=always --name 容器名 -d ubuntu /bin/sh -c "while true;do echo hello world; sleep 1; done"` 无论退出代码是什么，docker都会自动重启容器，可以设置 --restart=on-failure:5 自动重启的次数
    
-   `docker inspect` 容器名 对容器进行详细的检查，可以加 --format=‘{(.State.Running)}’ 来获取指定的信息
    
-   `docker rm` 容器ID 删除容器，注，运行中的容器无法删除
    
-   `docker rm $(docker ps -aq)` 删除所有容器
    
-   `docker rmi $(docker images -aq)` 删除所有镜像
    
-   `docker images` 列出镜像
    
-   `docker pull` 镜像名:标签 拉镜像
    
-   `docker search` 查找docker Hub 上公共的可用镜像
    
-   `docker build -t='AT/web_server:v1'` 命令后面可以直接加上github仓库的要目录下存在的Dockerfile文件。 命令是编写Dockerfile 之后使用的。-t选项为新镜像设置了仓库和名称:标签
    
-   `docker login` 登陆到Docker Hub，个人认证信息将会保存到$HOME/.dockercfg,
    
-   `docker commit -m="comment " --author="AT"` 容器ID 镜像的用户名/仓库名:标签 不推荐这种方法，推荐dockerfile
    
-   `docker history` 镜像ID 深入探求镜像是如何构建出来的
    
-   `docker port` 镜像ID 端口 查看映射情况的容器的ID和容器的端口号，假设查询80端口对应的映射的端口
    
-   `run` 运行一个容器， -p 8080:80 将容器内的80端口映射到docker宿主机的某一特定端口，将容器的80端口绑定到宿主机的8080端口，另 127.0.0.1:80:80 是将容器的80端口绑定到宿主机这个IP的80端口上，-P 是将容器内的80端口对本地的宿主机公开
    
-   `docker push` 镜像名 将镜像推送到 Docker Hub
    
-   `docker rmi` 镜像名 删除镜像
    
-   `docker attach` 容器ID 进入容器
    
-   `docker network create --subnet=172.171.0.0/16` docker-at 选取172.172.0.0网段
    
-   `docker build` 就可以加 -ip指定容器ip 172.171.0.10 了
    

docker 镜像操作

```shell
 docker images：列出images
    
 docker images -a：列出所有的images（包含历史）
    
 docker images --tree ：显示镜像的所有层(layer)
    
 docker rmi  <image ID>：删除一个或多个image

```

docker 容器操作

```shell
#启动容器
docker start <ContainerId(或者name)>
#停止容器
docker stop <ContainerId(或者name)>
docker stop -t=60 容器ID或容器名
参数 -t：关闭容器的限时，如果超时未能关闭则用kill强制关闭，默认值10s，这个时间用于容器的自己保存状态
#重启容器
docker restart <ContainerId(或者name)>
#删除容器
docker rm <ContainerId(或者name)>
docker rm -f 容器ID或容器名 ：直接删除正在运行的容器
#删除所有容器
docker rm $(docker ps -a -q)
#进入容器
docker exec -it containerID /bin/bash
# 查看容器日志
docker logs -f -t --tail 行数 容器名

```

Dockerfile语法

-   `MAINTAINER` 标识镜像的作者和联系方式
    
-   `EXPOSE` 可以指定多个EXPOSE向外部公开多个端口，可以帮助多个容器链接
    
-   `FROM` 指令指定一个已经存在的镜像
    
-   `RUN` 运行命令,会在shell 里使用命令包装器 /bin/sh -c 来执行。如果是在一个不支持shell 的平台上运行或者不希望在shell 中运行，也可以 使用exec 格式 的RUN指令
    
-   `ENV REFRESHED_AT` 环境变量 这个环境亦是用来表明镜像模板最后的更新时间
    
-   `VOLUME` 容器添加卷。一个卷是可以 存在于一个或多个容器内的特定的目录，对卷的修改是立刻生效的，对卷的修改不会对更新镜像产品影响，例:VOLUME\[“/opt/project”,“/data”\]
    
-   `ADD` 将构建环境 下的文件 和目录复制到镜像 中。例 ADD nginx.conf /conf/nginx.conf 也可以是取url 的地址文件，如果是压缩包，ADD命令会自动解压、
    
-   `USER` 指定镜像用那个USER 去运行
    
-   `COPY` 是复制本地文件，而不会去做文件提取（解压包不会自动解压） 例：COPY conf.d/ /etc/apache2/ 将本地conf.d目录中的文件复制到/etc/apache2/目录中
    
-   `CMD` 类似于RUN指令，CMD指令也可用于运行任何命令或应用程序，不过，二者的运行时间点不同
    
    -   `RUN` 指令运行于映像文件构建过程中，而CMD指令运行于基于Dockerfile构建出的新镜像文件启动一个容器时。
        
    -   `CMD`指令的首要目的在于为启动的容器指定默认要运行的程序，且其运行结束后，容器也将终止;不过，CMD指定的命令其可以被docker run的命令行选项所覆盖
        
    -   在Dockerfile中可以存在多个CMD指令，但仅最后一个生效
        

> 你要尽全力保护你的梦想。那些嘲笑你梦想的人，因为他们必定会失败，他们想把你变成和他们一样的人。 —《当幸福来敲门》