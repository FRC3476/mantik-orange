import { pg } from './helpers';
import type { JavaPlaygroundExercise } from '../types';

export const OOP: JavaPlaygroundExercise[] = [
  pg(
    'java-classes',
    'Practice: classes',
    `Finish Counter so add(int n) increases value, and get() returns it.
In main, add 1 then 2, then print get().

Expected:

3`,
    `class Counter {
    private int value;

    public void add(int n) {
        // add n to value
    }

    public int get() {
        return 0;
    }
}

public class Main {
    public static void main(String[] args) {
        Counter c = new Counter();
        c.add(1);
        c.add(2);
        System.out.println(c.get());
    }
}
`,
    [{ name: '1 + 2', stdout: '3' }],
  ),
  pg(
    'java-objects',
    'Practice: objects',
    `Create two Bot objects named Alpha and Beta. Print each name on its own line.

Expected:

Alpha
Beta`,
    `class Bot {
    String name;

    Bot(String name) {
        this.name = name;
    }
}

public class Main {
    public static void main(String[] args) {
        // create two Bot objects and print their names
    }
}
`,
    [{ name: 'Two bots', stdout: 'Alpha\nBeta' }],
  ),
  pg(
    'java-objects-references',
    'Practice: references',
    `a and b should point at the same Cell. Set a.value to 5, then print b.value.

Expected:

5`,
    `class Cell {
    int value;
}

public class Main {
    public static void main(String[] args) {
        Cell a = new Cell();
        Cell b = a;
        // set a.value, then print b.value
    }
}
`,
    [{ name: 'Shared object', stdout: '5' }],
  ),
  pg(
    'java-overloading',
    'Practice: overloading',
    `Give Label two constructors:
- Label() sets text to "none"
- Label(String s) sets text to s

Print two labels: the no-arg one, then one with "arm".

Expected:

none
arm`,
    `class Label {
    String text;

    // two constructors
}

public class Main {
    public static void main(String[] args) {
        // print both labels
    }
}
`,
    [{ name: 'Two constructors', stdout: 'none\narm' }],
  ),
  pg(
    'java-inheritance',
    'Practice: inheritance',
    `NeoMotor should extend Motor and inherit type. Print new NeoMotor().type

Expected:

motor`,
    `class Motor {
    String type = "motor";
}

class NeoMotor extends Motor {
}

public class Main {
    public static void main(String[] args) {
        System.out.println(new NeoMotor().type);
    }
}
`,
    [{ name: 'Inherited field', stdout: 'motor' }],
  ),
  pg(
    'java-abstract-classes',
    'Practice: abstract classes',
    `Gyro must implement id(). Print new Gyro().id()

Expected:

gyro`,
    `abstract class Device {
    abstract String id();
}

class Gyro extends Device {
    String id() {
        return "";
    }
}

public class Main {
    public static void main(String[] args) {
        Device d = new Gyro();
        System.out.println(d.id());
    }
}
`,
    [{ name: 'Abstract method', stdout: 'gyro' }],
  ),
  pg(
    'java-interfaces',
    'Practice: interfaces',
    `Team must implement Named. Print new Team().name()

Expected:

3476`,
    `interface Named {
    String name();
}

class Team implements Named {
    public String name() {
        return "";
    }
}

public class Main {
    public static void main(String[] args) {
        Named n = new Team();
        System.out.println(n.name());
    }
}
`,
    [{ name: 'Interface method', stdout: '3476' }],
  ),
  pg(
    'java-runtime-polymorphism',
    'Practice: polymorphism',
    `Dog.speak should print woof. Keep the variable type as Animal.

Expected:

woof`,
    `class Animal {
    void speak() {
        System.out.println("...");
    }
}

class Dog extends Animal {
    void speak() {
    }
}

public class Main {
    public static void main(String[] args) {
        Animal a = new Dog();
        a.speak();
    }
}
`,
    [{ name: 'Overridden speak', stdout: 'woof' }],
  ),
];
