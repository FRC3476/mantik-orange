import { pg } from './helpers';
import type { JavaPlaygroundExercise } from '../types';

export const CONCURRENCY: JavaPlaygroundExercise[] = [
  pg(
    'java-threads-basics',
    'Practice: threads',
    `Start a thread that prints worker. Join it, then print done.

Expected:

worker
done`,
    `public class Main {
    public static void main(String[] args) throws Exception {
        Thread t = new Thread(new Runnable() {
            public void run() {
                System.out.println("worker");
            }
        });
        // start, join, then print done
    }
}
`,
    [{ name: 'Join worker', stdout: 'worker\ndone' }],
  ),
  pg(
    'java-race-conditions',
    'Practice: synchronized',
    `Increment the counter 10 times through inc(). Print the value.

Expected:

10`,
    `class Counter {
    int value;

    synchronized void inc() {
        value++;
    }
}

public class Main {
    public static void main(String[] args) {
        Counter c = new Counter();
        for (int i = 0; i < 10; i++) {
            c.inc();
        }
        System.out.println(c.value);
    }
}
`,
    [{ name: 'Ten increments', stdout: '10' }],
  ),
  pg(
    'java-executors',
    'Practice: executor',
    `Submit a task that prints pool, shut down the executor, then wait for it.

Expected:

pool`,
    `import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

public class Main {
    public static void main(String[] args) throws Exception {
        ExecutorService ex = Executors.newSingleThreadExecutor();
        ex.submit(new Runnable() {
            public void run() {
                // print pool
            }
        });
        ex.shutdown();
        ex.awaitTermination(2, TimeUnit.SECONDS);
    }
}
`,
    [{ name: 'Single task', stdout: 'pool' }],
  ),
  pg(
    'java-concurrent-collections',
    'Practice: ConcurrentHashMap',
    `Put "a" -> 1 in the map. Print get("a").

Expected:

1`,
    `import java.util.concurrent.ConcurrentHashMap;

public class Main {
    public static void main(String[] args) {
        ConcurrentHashMap<String, Integer> map = new ConcurrentHashMap<String, Integer>();
        // put and print
    }
}
`,
    [{ name: 'Map get', stdout: '1' }],
  ),
];
