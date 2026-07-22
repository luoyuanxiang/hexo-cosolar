---
title: Java基础核心知识点详解
description: 本文系统介绍了Java语言的核心基础概念，包括语言特点、面向对象与面向过程区别、基本数据类型与封装类、命名规则、instanceof关键字、自动装箱与拆箱机制，以及重载与重写的区别，适合Java初学者系统学习。
tags:
- Java
- 基础
categories:
- 开发笔记
- 生活随笔
cover: https://cdn.luoyuanxiang.top/cover-java-fundamentals.webp
date: '2025-09-04 14:57:00'
---

## 基础篇

### 1、 Java语言有哪些特点

1.  简单易学、有丰富的类库  
    阿里内部资料
2.  面向对象（Java最重要的特性，让程序耦合度更低，内聚性更高）
3.  与平台无关性（JVM是Java跨平台使用的根本）
4.  可靠安全
5.  支持多线程

### 2、面向对象和面向过程的区别

面向过程：是分析解决问题的步骤，然后用函数把这些步骤一步一步地实现，然后在使用的时候一  
一调用则可。性能较高，所以单片机、嵌入式开发等一般采用面向过程开发  
面向对象：是把构成问题的事务分解成各个对象，而建立对象的目的也不是为了完成一个个步骤，  
而是为了描述某个事物在解决整个问题的过程中所发生的行为。面向对象有封装、继承、多态的特  
性，所以易维护、易复用、易扩展。可以设计出低耦合的系统。 但是性能上来说，比面向过程要  
低。

### 3 、八种基本数据类型的大小，以及他们的封装类

| 基本类型 | 大小（字节） | 默认值 | 封装类 |
| :---: | :---: | :---: | :---: |
| byte | 1   | (byte)0 | Byte |
| short | 2   | (short)0 | Short |
| int | 4   | 0   | Integer |
| long | 8   | 0L  | Long |
| float | 4   | 0.0f | Float |
| double | 8   | 0.0d | Double |
| boolean | \-  | false | Boolean |
| char | 1   | \\u0000(null) | Character |

**注**

1.  int是基本数据类型，Integer是int的封装类，是引用类型。int默认值是0，而Integer默认值  
    是null，所以Integer能区分出0和null的情况。一旦java看到null，就知道这个引用还没有指向某个  
    对象，再任何引用使用前，必须为其指定一个对象，否则会报错。
    
2.  基本数据类型在声明时系统会自动给它分配空间，而引用类型声明时只是分配了引用空间，  
    必须通过实例化开辟数据空间之后才可以赋值。数组对象也是一个引用对象，将一个数组赋值给另  
    一个数组时只是复制了一个引用，所以通过某一个数组所做的修改在另一个数组中也看的见。
    
3.  虽然定义了boolean这种数据类型，但是只对它提供了非常有限的支持。在Java虚拟机中没有  
    任何供boolean值专用的字节码指令，Java语言表达式所操作的boolean值，在编译之后都使用Java  
    虚拟机中的int数据类型来代替，而boolean数组将会被编码成Java虚拟机的byte数组，每个元素  
    boolean元素占8位。这样我们可以得出boolean类型占了单独使用是4个字节，在数组中又是1个字  
    节。使用int的原因是，对于当下32位的处理器（CPU）来说，一次处理数据是32位（这里不是指的  
    是32/64位系统，而是指CPU硬件层面），具有高效存取的特点。
    

### 4、标识符的命名规则。

**标识符的含义：** 是指在程序中，我们自己定义的内容，譬如，类的名字，方法名称以及变量名称等  
等，都是标识符。

**命名规则：（硬性要求）** 标识符可以包含英文字母，0-9的数字，$以及\_ 标识符不能以数字开头 标  
识符不是关键字

**命名规范：（非硬性要求） 类名规范：** 首字符大写，后面每个单词首字母大写（大驼峰式）。 变量  
名规范：首字母小写，后面每个单词首字母大写（小驼峰式）。 方法名规范：同变量名。

### 5、instanceof 关键字的作用

`instanceof` 严格来说是Java中的一个双目运算符，用来测试一个对象是否为一个类的实例，用法  
为：

```java
boolean result = obj instanceof Class

```

其中 obj 为一个对象，Class 表示一个类或者一个接口，当 obj 为 Class 的对象，或者是其直接  
或间接子类，或者是其接口的实现类，结果result 都返回 true，否则返回false。

注意：编译器会检查 obj 是否能转换成右边的class类型，如果不能转换则直接报错，如果不能  
确定类型，则通过编译，具体看运行时定。

```java
 int i = 0;
 System.out.println(i instanceof Integer);// 编译不通过  i必须是引用类型，不能是基本类型
System.out.println(i instanceof Object);// 编译不通过

```

```java
Integer integer = new Integer(1);
 System.out.println(integer instanceof  Integer);// true

```

```java
 // false,在 JavaSE规范 中对 instanceof 运算符的规定就是：如果 obj 为 null，那么将返回 false。
System.out.println(null instanceof Object);

```

### 6、Java自动装箱与拆箱

装箱就是自动将基本数据类型转换为包装器类型（int–>Integer）；调用方法：Integer的  
valueOf(int) 方法

拆箱就是自动将包装器类型转换为基本数据类型（Integer–>int）。调用方法：Integer的  
intValue方法

在Java SE5之前，如果要生成一个数值为10的Integer对象，必须这样进行：

```java
Integer i = new Integer(10);

```

而在从Java SE5开始就提供了自动装箱的特性，如果要生成一个数值为10的Integer对象，只需要  
这样就可以了：

```java
Integer i = 10;

```

**面试题1： 以下代码会输出什么？**

```java
public class Main {
    public static void main(String[] args) {
         
        Integer i1 = 100;
        Integer i2 = 100;
        Integer i3 = 200;
        Integer i4 = 200;
         
        System.out.println(i1==i2);
        System.out.println(i3==i4);
    }
 }

```

运行结果：

```java
 true
 false

```

为什么会出现这样的结果？输出结果表明i1和i2指向的是同一个对象，而i3和i4指向的是不同的对  
象。此时只需一看源码便知究竟，下面这段代码是Integer的valueOf方法的具体实现：

```java
public static Integer valueOf(int i) {
        if(i >= -128 && i <= IntegerCache.high)
            return IntegerCache.cache[i + 128];
        else
            return new Integer(i);
    }

```

其中IntegerCache类的实现为：

```java
private static class IntegerCache {
        static final int high;
        static final Integer cache[];
 
        static {
            final int low = -128;
 
            // high value may be configured by property
            int h = 127;
            if (integerCacheHighPropValue != null) {
                // Use Long.decode here to avoid invoking methods that
                // require Integer's autoboxing cache to be initialized
                int i = Long.decode(integerCacheHighPropValue).intValue();
                i = Math.max(i, 127);
                // Maximum array size is Integer.MAX_VALUE
                h = Math.min(i, Integer.MAX_VALUE - -low);
            }
            high = h;
 
            cache = new Integer[(high - low) + 1];
            int j = low;
            for(int k = 0; k < cache.length; k++)
                cache[k] = new Integer(j++);
        }
 
        private IntegerCache() {}
    }

```

从这2段代码可以看出，在通过valueOf方法创建Integer对象的时候，如果数值在\[-128,127\]之间，  
便返回指向IntegerCache.cache中已经存在的对象的引用；否则创建一个新的Integer对象。

上面的代码中i1和i2的数值为100，因此会直接从cache中取已经存在的对象，所以i1和i2指向的是  
同一个对象，而i3和i4则是分别指向不同的对象。

**面试题2：以下代码输出什么**

```java
public class Main {
    public static void main(String[] args) {
         
        Double i1 = 100.0;
        Double i2 = 100.0;
        Double i3 = 200.0;
        Double i4 = 200.0;
         
        System.out.println(i1==i2);
        System.out.println(i3==i4);
    }
 }

```

运行结果：

```java
 false
 false

```

原因： 在某个范围内的整型数值的个数是有限的，而浮点数却不是。

### 7、 重载和重写的区别

**重写(Override)**

从字面上看，重写就是 重新写一遍的意思。其实就是在子类中把父类本身有的方法重新写一遍。子  
类继承了父类原有的方法，但有时子类并不想原封不动的继承父类中的某个方法，所以在方法名，  
参数列表，返回类型(除过子类中方法的返回值是父类中方法返回值的子类时)都相同的情况下， 对  
方法体进行修改或重写，这就是重写。但要注意子类函数的访问修饰权限不能少于父类的。

```java
public class Father {
 
    public static void main(String[] args) {
        // TODO Auto-generated method stub
        Son s = new Son();
        s.sayHello();
    }
 
    public void sayHello() {
        System.out.println("Hello");
    }
 }
 
class Son extends Father {
     @Override
    public void sayHello() {
        // TODO Auto-generated method stub
        System.out.println("hello by ");
    }
}

```

**重写 总结：**

1.  发生在父类与子类之间
2.  方法名，参数列表，返回类型（除过子类中方法的返回类型是父类中返回类型的子类）必须相同
3.  访问修饰符的限制一定要大于被重写方法的访问修饰符 （public>protected>default>private)
4.  重写方法一定不能抛出新的检查异常或者比被重写方法申 明更加宽泛的检查型异常

**重载（Overload）**

在一个类中，同名的方法如果有不同的参数列表（参数类型不同、参数个数不同甚至是参数顺序不  
同）则视为重载。同时，重载对返回类型没有要求，可以相同也可以不同，但不能通过返回类型是  
否相同来判断重载。

```java
 public class Father {
 
    public static void main(String[] args) {
        // TODO Auto-generated method stub
        Father s = new Father();
        s.sayHello();
        s.sayHello("wintershii");
 
    }
 
    public void sayHello() {
        System.out.println("Hello");
    }
 
    public void sayHello(String name) {
        System.out.println("Hello" + " " + name);
    }
 }

```

**重载 总结：**

1.  重载Overload是一个类中多态性的一种表现
2.  重载要求同名方法的参数列表不同(参数类型，参数个数甚至是参数顺序)
3.  重载的时候，返回值类型可以相同也可以不相同。无法以返回型别作为重载函数的区分标准