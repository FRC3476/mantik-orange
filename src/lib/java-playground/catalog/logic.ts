import { main, pg } from './helpers';
import type { JavaPlaygroundExercise } from '../types';

export const LOGIC: JavaPlaygroundExercise[] = [
  pg(
    'java-conditionals',
    'Practice: conditionals',
    `Read one integer from System.in. Print LOW if it is less than 50, otherwise print OK.

Check runs two hidden inputs. The input box is only used when you click Run.`,
    main(`        java.util.Scanner in = new java.util.Scanner(System.in);
        int percent = in.nextInt();
        // Print LOW or OK`),
    [
      { name: 'Below 50', stdin: '40\n', stdout: 'LOW' },
      { name: 'At least 50', stdin: '80\n', stdout: 'OK' },
    ],
    true,
  ),
  pg(
    'java-methods',
    'Practice: methods',
    `Write a method named doubleIt that takes an int and returns twice that value.
From main, print doubleIt(21) on its own line.

Expected output:

42`,
    `public class Main {
    // Write doubleIt here

    public static void main(String[] args) {
        // Print doubleIt(21)
    }
}
`,
    [{ name: 'doubleIt(21)', stdout: '42' }],
  ),
  pg(
    'java-control',
    'Practice: control flow',
    `distance is already set. Print one line:
- FAR if distance is greater than 20
- NEAR if distance is greater than 5
- STOP otherwise

The hidden check uses distance = 12, so the line should be:

NEAR`,
    main(`        int distance = 12;
        // Print FAR, NEAR, or STOP`),
    [{ name: 'Mid range', stdout: 'NEAR' }],
  ),
  pg(
    'java-try-catch',
    'Practice: try-catch',
    `Read one line from System.in. Try Integer.parseInt on it.
If it parses, print the number. If it throws NumberFormatException, print bad.

Check runs two hidden inputs.`,
    main(`        java.util.Scanner in = new java.util.Scanner(System.in);
        String line = in.nextLine();
        // parse or print bad`),
    [
      { name: 'Valid int', stdin: '7\n', stdout: '7' },
      { name: 'Not a number', stdin: 'abc\n', stdout: 'bad' },
    ],
    true,
  ),
];
