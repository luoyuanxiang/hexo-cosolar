---
title: GitHub Actions自动化部署Spring Boot至阿里云镜像仓库
description: 本文详细介绍了如何通过GitHub Actions工作流实现Spring Boot项目的自动化构建与部署，包括Docker镜像打包及推送至阿里云容器镜像服务的完整配置流程和注意事项。
tags:
- docker
- GitHub
- actions
categories:
- 生活随笔
date: '2025-09-05 15:26:34'
cover: https://cdn.luoyuanxiang.top/cover-github-actions-springboot-acr.webp
---

# 使用 GitHub Actions 实现 Spring Boot 项目打包并推送至阿里云镜像仓库

## GitHub Actions 配置文件

在项目根目录下创建 `.github/workflows/docker-publish.yml` 文件，内容如下：

```yaml
# 此工作流用于构建 Spring Boot 项目并推送 Docker 镜像至阿里云容器镜像服务
# 更多信息请参考：https://docs.github.com/en/actions

name: 构建并推送至阿里云容器镜像

# 触发条件：推送到 master 分支或创建 v 开头的标签时触发，同时监控 master 分支的拉取请求
on:
  push:
    branches: [ master ]
    tags: [ 'v*' ]
  pull_request:
    branches: [ master ]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: 检出代码
        uses: actions/checkout@v3

      - name: 登录阿里云容器镜像服务
        uses: aliyun/acr-login@v1
        with:
          login-server: ${{ secrets.ALIYUN_ACR_REGISTRY }}  # 示例：registry.cn-beijing.aliyuncs.com
          username: ${{ secrets.ALIYUN_ACR_USERNAME }}
          password: ${{ secrets.ALIYUN_ACR_PASSWORD }}

      - name: 构建并推送 Docker 镜像
        env:
          ACR_REGISTRY: ${{ secrets.ALIYUN_ACR_REGISTRY }}
          ACR_NAMESPACE: ${{ secrets.ALIYUN_ACR_NAMESPACE }}  # 命名空间
          DOCKER_VERSION: latest
          IMAGE_NAME: thrive-blog  # 镜像名称
        run: |
          # 构建镜像
          docker build -t $ACR_REGISTRY/$ACR_NAMESPACE/$IMAGE_NAME:$DOCKER_VERSION .
          
          # 推送镜像至仓库
          docker push $ACR_REGISTRY/$ACR_NAMESPACE/$IMAGE_NAME:$DOCKER_VERSION

      - name: 连接服务器并部署应用
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.REMOTE_HOST }}
          username: ${{ secrets.REMOTE_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          port: 22
          script: |
            echo "开始执行服务器部署命令"
            # 停止并移除旧容器
            docker stop thrive-blog || true
            docker rm thrive-blog || true
            
            # 清理旧镜像并拉取最新镜像
            docker rmi registry.cn-chengdu.aliyuncs.com/thrivex-blog/thrive-blog:latest || true
            docker pull registry.cn-chengdu.aliyuncs.com/thrivex-blog/thrive-blog:latest
            
            # 使用 Docker Compose 重新部署应用
            cd /root/thrive-blog
            docker-compose up -d
            echo "服务器部署完成"
```

> [!NOTE] 配置说明
> - **分支配置**：请根据实际项目需求调整监控的分支名称
> - **ALIYUN_ACR_REGISTRY**：阿里云容器镜像服务地址，例如：registry.cn-beijing.aliyuncs.com
> - **ALIYUN_ACR_USERNAME**：阿里云账号用户名
> - **ALIYUN_ACR_PASSWORD**：阿里云账号密码
> - **ALIYUN_ACR_NAMESPACE**：容器镜像服务的命名空间
> - **REMOTE_HOST**：服务器 IP 地址
> - **REMOTE_USER**：服务器用户名
> - **SSH_PRIVATE_KEY**：服务器 SSH 私钥

## Dockerfile 配置文件

```dockerfile
# 使用 Maven 和 JDK 8 作为构建环境
FROM maven:3.6.3-openjdk-8 AS builder

# 设置工作目录
WORKDIR /app

# 复制项目文件
COPY . .

# 执行 Maven 构建，跳过测试阶段以提高构建效率
RUN mvn install -Dmaven.test.skip=true -P pro

# 使用轻量级 JRE 环境作为运行时镜像
FROM openjdk:8-jre-alpine

# 维护者信息
LABEL maintainer="1141306760@qq.com"

# 设置时区为上海
ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# 设置工作目录
WORKDIR /app

# 从构建阶段复制生成的 Jar 文件
COPY --from=builder /app/blog/target/*.jar app.jar

# 声明应用端口
EXPOSE 9003

# 使用 exec 格式启动应用，确保正确接收系统信号
ENTRYPOINT ["java", "-jar", "app.jar"]
```

> [!TIP] 提示
> Dockerfile 中已包含完整的项目构建配置，可与 GitHub Actions 工作流无缝配合，实现从代码到镜像的全自动打包和部署流程。