import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { NonInteractiveError } from "./errors.js";
import { isNonInteractiveMode } from "./runtime.js";
export async function ask(question, defaultValue) {
    if (isNonInteractiveMode()) {
        if (defaultValue !== undefined)
            return defaultValue;
        throw new NonInteractiveError(`Missing required value for '${question}' in non-interactive mode.`);
    }
    const rl = readline.createInterface({ input, output });
    const prompt = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
    const answer = await rl.question(prompt);
    rl.close();
    return answer.trim() || defaultValue || "";
}
export async function pickOne(prompt, items) {
    if (isNonInteractiveMode()) {
        throw new NonInteractiveError(`Cannot prompt for '${prompt}' in non-interactive mode.`);
    }
    items.forEach((item, i) => console.log(`  ${i + 1}. ${item}`));
    const rl = readline.createInterface({ input, output });
    let index = -1;
    while (index < 0) {
        const answer = await rl.question(`${prompt} (1-${items.length}): `);
        const n = parseInt(answer.trim(), 10);
        if (n >= 1 && n <= items.length) {
            index = n - 1;
        }
        else {
            console.log(`Enter a number from 1 to ${items.length}.`);
        }
    }
    rl.close();
    return index;
}
//# sourceMappingURL=prompt.js.map