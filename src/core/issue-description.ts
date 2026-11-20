import { readFileSync } from "node:fs";
import { getErrorMessage, ValidationError } from "./errors.js";

export interface IssueDescription {
  description?: string;
  descriptionHtml?: string;
  descriptionFile?: string;
}

export function readIssueDescription(fields: IssueDescription): string | undefined {
  const { description, descriptionHtml, descriptionFile } = fields;
  if (
    [description, descriptionHtml, descriptionFile].filter((value) => value !== undefined).length >
    1
  ) {
    throw new ValidationError(
      "--description, --description-html, and --description-file are mutually exclusive.",
    );
  }
  if (descriptionFile === undefined) {
    return descriptionHtml ?? (description === undefined ? undefined : `<p>${description}</p>`);
  }

  let input: string;
  try {
    input = readFileSync(descriptionFile === "-" ? 0 : descriptionFile, "utf8");
  } catch (error) {
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
