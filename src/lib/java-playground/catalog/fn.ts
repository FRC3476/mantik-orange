import { pg } from './helpers';
import type { JavaPlaygroundExercise } from '../types';

export const FUNCTIONS: JavaPlaygroundExercise[] = [
  pg(
    'java-fn-functions-as-data',
    'Practice: functions as data',
    `Store a Printer in a variable and call print(). Print hello.

Expected:

hello`,
    `interface Printer {
    void print();
}

class HelloPrinter implements Printer {
    public void print() {
        // print hello
    }
}

public class Main {
    public static void main(String[] args) {
        Printer p = new HelloPrinter();
        p.print();
    }
}
`,
    [{ name: 'Call through interface', stdout: 'hello' }],
  ),
  pg(
    'java-fn-lambdas',
    'Practice: lambdas',
    `Assign a lambda that doubles its argument. Print apply(5).

Expected:

10`,
    `interface Fn {
    int apply(int n);
}

public class Main {
    public static void main(String[] args) {
        Fn f = n -> 0;
        System.out.println(f.apply(5));
    }
}
`,
    [{ name: 'Double 5', stdout: '10' }],
  ),
  pg(
    'java-fn-method-references',
    'Practice: method references',
    `Point a Fn at Main.hello using a method reference. Call run().

Expected:

hi`,
    `interface Fn {
    void run();
}

public class Main {
    static void hello() {
        System.out.println("hi");
    }

    public static void main(String[] args) {
        Fn f = Main::hello;
        f.run();
    }
}
`,
    [{ name: 'Method reference', stdout: 'hi' }],
  ),
  pg(
    'java-fn-supplier',
    'Practice: Supplier',
    `Make a Supplier<String> that returns ready. Print get().

Expected:

ready`,
    `import java.util.function.Supplier;

public class Main {
    public static void main(String[] args) {
        Supplier<String> s = () -> "";
        System.out.println(s.get());
    }
}
`,
    [{ name: 'Supplier get', stdout: 'ready' }],
  ),
];
