import { readFileSync } from "node:fs";
import { getErrorMessage, ValidationError } from "./errors.js";
import { markdownToHtml } from "./markdown.js";
export function readIssueDescription(fields) {
    const { description, descriptionHtml, descriptionFile, descriptionMarkdown } = fields;
    if ([description, descriptionHtml, descriptionFile, descriptionMarkdown].filter((value) => value !== undefined).length > 1) {
        throw new ValidationError("--description, --description-html, --description-file, and --description-markdown are mutually exclusive.");
    }
    if (descriptionMarkdown !== undefined) {
        return descriptionMarkdown === "" ? "" : markdownToHtml(descriptionMarkdown);
    }
    if (descriptionFile === undefined) {
        return descriptionHtml ?? (description === undefined ? undefined : `<p>${description}</p>`);
    }
    let input;
    try {
        input = readFileSync(descriptionFile === "-" ? 0 : descriptionFile, "utf8");
    }
    catch (error) {
        const source = descriptionFile === "-" ? "stdin" : JSON.stringify(descriptionFile);
        throw new ValidationError(`Cannot read description from ${source}: ${getErrorMessage(error)}`);
    }
    const html = input
        .replace(/^\uFEFF/, "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\r\n|\r|\n/g, "<br>");
    return `<p>${html}</p>`;
}
//# sourceMappingURL=issue-description.js.map