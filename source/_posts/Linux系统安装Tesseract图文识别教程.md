---
title: Linux系统安装Tesseract图文识别教程
description: 本文详细介绍了在Linux系统中安装Tesseract OCR引擎的完整步骤，包括依赖包下载、环境变量配置、编译安装过程及最终版本验证方法，帮助用户顺利完成安装。
tags:
- tesseract
- shell
- Linux
categories:
- 开发笔记
image: https://cdn.luoyuanxiang.top/cover-linux-tesseract-ocr.webp
date: '2025-09-04 14:57:00'
---

## Linux 安装 Tesseract

### 下载需要的包

#### tesseract 需要单独下载

```shell
https://github.com/tesseract-ocr/tesseract/releases/tag/5.3.3

```

#### 下载leptonica

```shell
wget http://www.leptonica.org/source/leptonica-1.78.0.tar.gz

```

### 安装依赖

#### 解压leptonica

```shell
tar -xvf leptonica-1.78.0.tar.gz

```

#### 配置编译安装leptonica,进入到文件夹中

```shell
./configure
make
make install

```

#### 安装automake和libtool

```shell
yum -y install automake libtool

```

### 配置leptonica环境变量

#### 修改profile,可以使用命令行或者直接编辑

```shell
vim /etc/profile

```

#### 在文件结尾添加

```shell
export LD_LIBRARY_PATH=/usr/local/lib
export LIBLEPT_HEADERSDIR=/usr/local/include
export PKG_CONFIG_PATH=/usr/local/lib/pkgconfig

```

#### 保存并退出文件

#### 执行以下命令使配置生效

```shell
source /etc/profile

```

### 安装tesseract-ocr

#### 安装依赖

```shell
yum install -y centos-release-scl devtoolset-8-gcc*

```

#### 切换当前会话中gcc版本为8

```shell
scl enable devtoolset-8 bash

```

#### 安装

```shell
yum install gcc-c++ libstdc++-devel
tar -xvf tesseract-4.0.0.tar.gz
cd ./tesseract-4.0.0
./autogen.sh
./configure
make
make install

```

#### 测试是否安装成功,执行ldconfig

```shell
tesseract --version

```