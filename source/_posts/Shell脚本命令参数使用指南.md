---
title: Shell脚本命令参数使用指南
description: 本文详细介绍了用于启动、停止、备份和查看日志的Shell脚本命令参数，包括-s/--start启动服务、-stop停止服务、-c/--copy备份项目以及-l/--log查看日志，各命令均需指定端口号操作。
tags:
- Linux
- shell
categories:
- 开发笔记
cover: https://cdn.luoyuanxiang.top/cover-shell-script-params.webp
date: '2025-09-04 14:57:00'
---

## 命令参数

> [!NOTE] 示例
> - `-s|--start`：启动服务，后跟端口号
> - `-stop`：停止服务，后跟端口号
> - `-c|--copy`：备份并更新项目文件
> - `-l|--log`：查看日志，后跟端口号
> - 示例：`sh xxx.sh -s 12000` 启动端口为 12000 的服务

```shell
# 项目名称
APP_NAME=safirst-etmf-api-1.0.0.jar

# 根据端口号启动服务
start_port() {
  echo "准备启动服务，端口号：$PORT"
  pid=$(netstat -an | grep $PORT | awk '{print $4}')
  echo "当前进程信息：$pid"
  if [[ -n $pid ]]; then
    echo "端口号 $PORT 的服务已在运行"
  else
    echo "正在启动服务..."
    nohup java -jar $APP_NAME --server.port=${PORT} --logging.file.name=/mnt/nas/etmf/irzhd-logs-api-$PORT-105/spring.log > /dev/null &
  fi
  exit 1
}

# 备份并更新项目文件
copy_c() {
  FILE_NAME=$(date -d last-day +%Y%m%d)
  echo "开始备份项目..."
  cp $APP_NAME ${APP_NAME}_${FILE_NAME}
  echo "备份完成：${APP_NAME}_${FILE_NAME}"
  echo "正在更新项目文件..."
  cp /mnt/nas/jar/$APP_NAME .
  echo "项目更新成功"
  exit 1
}

# 停止指定端口的服务
stop_s() {
  echo "正在停止端口 $PORT 的服务..."
  ps -ef | grep $PORT | grep -v grep | awk '{print $2}' | xargs kill -9
  echo "服务已停止"
  exit 1
}

# 查看日志
log_port() {
  tail -f /mnt/nas/etmf/irzhd-logs-api-$PORT-105/spring.log
  exit 1
}

# 使用说明
usage() {
  echo "Usage: ${0} [-s|--start] [-stop] [-c|--copy] [-l|--log]" 1>&2
  exit 1
}

# 参数解析
while [[ $# -gt 0 ]]; do
  key=${1}
  case ${key} in
    -s|--start)
      PORT=${2}
      if [[ ! -n $PORT ]]; then
        echo "请提供端口号，例如：-s 12000"
        exit 1
      else
        echo "正在启动端口号：$PORT"
        shift 2
        start_port
      fi
      ;;
    -c|--copy)
      copy_c
      shift 2
      ;;
    -stop)
      PORT=${2}
      if [[ ! -n $PORT ]]; then
        echo "请提供端口号，例如：-stop 12000"
        exit 1
      else
        stop_s
        shift 2
      fi
      ;;
    -l|--log)
      PORT=${2}
      if [[ ! -n $PORT ]]; then
        echo "请提供端口号，例如：-l 12000"
        exit 1
      else
        log_port
        shift 2
      fi
      ;;
    *)
      usage
      shift
      ;;
  esac
done
```