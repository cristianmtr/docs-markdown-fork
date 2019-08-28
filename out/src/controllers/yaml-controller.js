"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const node_dir_1 = require("node-dir");
const path_1 = require("path");
const vscode_1 = require("vscode");
const log_messages_1 = require("../constants/log-messages");
const common_1 = require("../helper/common");
const telemetryCommand = "updateTOC";
let commandOption;
function yamlCommands() {
    // tslint:disable-next-line: no-shadowed-variable
    const commands = [
        { command: insertTocEntry.name, callback: insertTocEntry },
        { command: insertTocEntryWithOptions.name, callback: insertTocEntryWithOptions },
        { command: insertExpandableParentNode.name, callback: insertExpandableParentNode },
    ];
    return commands;
}
exports.yamlCommands = yamlCommands;
function insertTocEntry() {
    commandOption = "tocEntry";
    checkForPreviousEntry(false);
}
exports.insertTocEntry = insertTocEntry;
function insertTocEntryWithOptions() {
    commandOption = "tocEntryWithOptions";
    checkForPreviousEntry(true);
}
exports.insertTocEntryWithOptions = insertTocEntryWithOptions;
function insertExpandableParentNode() {
    commandOption = "expandableParentNode";
    createParentNode();
}
exports.insertExpandableParentNode = insertExpandableParentNode;
function showQuickPick(options) {
    const markdownExtensionFilter = [".md"];
    const headingTextRegex = /^(# )(.*)/gm;
    let folderPath = "";
    let fullPath = "";
    if (vscode_1.workspace.workspaceFolders) {
        folderPath = vscode_1.workspace.workspaceFolders[0].uri.fsPath;
    }
    // tslint:disable-next-line: no-shadowed-variable
    node_dir_1.files(folderPath, (err, files) => {
        if (err) {
            vscode_1.window.showErrorMessage(err);
            throw err;
        }
        const items = [];
        files.sort();
        files.filter((file) => markdownExtensionFilter.indexOf(path_1.extname(file.toLowerCase())) !== -1).forEach((file) => {
            items.push({ label: path_1.basename(file), description: path_1.dirname(file) });
        });
        // show the quick pick menu
        const selectionPick = vscode_1.window.showQuickPick(items);
        selectionPick.then((qpSelection) => {
            const editor = vscode_1.window.activeTextEditor;
            if (!editor) {
                common_1.noActiveEditorMessage();
                return;
            }
            if (!qpSelection) {
                return;
            }
            if (qpSelection.description) {
                fullPath = path_1.join(qpSelection.description, qpSelection.label);
            }
            const content = fs_1.readFileSync(fullPath, "utf8");
            const headings = content.match(headingTextRegex);
            if (!headings) {
                vscode_1.window.showErrorMessage(log_messages_1.noHeading);
                return;
            }
            let headingName = headings.toString().replace("# ", "");
            const hrefName = qpSelection.label;
            vscode_1.window.showInputBox({
                value: headingName,
                valueSelection: [0, 0],
            }).then((val) => {
                if (!val) {
                    vscode_1.window.showInformationMessage(log_messages_1.noHeadingSelected);
                }
                if (val) {
                    headingName = val;
                }
                createEntry(headingName, hrefName, options);
            });
        });
    });
}
exports.showQuickPick = showQuickPick;
function createEntry(name, href, options) {
    const editor = vscode_1.window.activeTextEditor;
    if (!editor) {
        return;
    }
    const position = editor.selection.active;
    const cursorPosition = position.character;
    const attributeSpace = "  ";
    const tocEntryLineStart = `- name: ${name}
  href: ${href}`;
    const tocEntryIndented = `- name: ${name}
  ${attributeSpace}href: ${href}`;
    const tocEntryWithOptions = `- name: ${name}
  displayname: #optional string for searching TOC
  href: ${href}
  uid: #optional string
  expanded: #true or false, false is default`;
    const tocEntryWithOptionsIndented = `- name: ${name}
  ${attributeSpace}displayname: #optional string for searching TOC
  ${attributeSpace}href: ${href}
  ${attributeSpace}uid: #optional string
  ${attributeSpace}expanded: #true or false, false is default`;
    if (cursorPosition === 0 && !options) {
        common_1.insertContentToEditor(editor, insertTocEntry.name, tocEntryLineStart);
    }
    if (cursorPosition > 0 && !options) {
        common_1.insertContentToEditor(editor, insertTocEntry.name, tocEntryIndented);
    }
    if (cursorPosition === 0 && options) {
        common_1.insertContentToEditor(editor, insertTocEntryWithOptions.name, tocEntryWithOptions);
    }
    if (cursorPosition > 0 && options) {
        common_1.insertContentToEditor(editor, insertTocEntryWithOptions.name, tocEntryWithOptionsIndented);
    }
    common_1.showStatusMessage(log_messages_1.insertedTocEntry);
    common_1.sendTelemetryData(telemetryCommand, commandOption);
}
exports.createEntry = createEntry;
function checkForPreviousEntry(options) {
    const editor = vscode_1.window.activeTextEditor;
    if (!editor) {
        return;
    }
    const position = editor.selection.active;
    const cursorPosition = position.character;
    const currentLine = position.line;
    // case 1: beginning of toc/first line
    if (currentLine === 0) {
        if (cursorPosition === 0) {
            launchQuickPick(options);
        }
        else {
            vscode_1.window.showErrorMessage(log_messages_1.invalidTocEntryPosition);
            return;
        }
    }
    const previousLine = currentLine - 1;
    const previousLineData = editor.document.lineAt(previousLine);
    const nameScalar = `- name:`;
    const itemsScalar = `items:`;
    const hrefScalar = `href:`;
    // case 2: name scalar on previous line
    if (previousLineData.text.includes(nameScalar)) {
        // if previous line starts with nameScalar check for cursor.  if equal, show quickpick.  if not, show error.
        if (previousLineData.firstNonWhitespaceCharacterIndex === cursorPosition) {
            launchQuickPick(options);
        }
        else {
            vscode_1.window.showErrorMessage(log_messages_1.invalidTocEntryPosition);
            return;
        }
    }
    // case 2: items scalar on previous line
    if (previousLineData.text.includes(itemsScalar)) {
        // if nameLine starts with itemsScalar check for cursor.  if equal, show quickpick.  if not, show error.
        if (previousLineData.firstNonWhitespaceCharacterIndex === cursorPosition) {
            launchQuickPick(options);
        }
        else {
            vscode_1.window.showErrorMessage(log_messages_1.invalidTocEntryPosition);
            return;
        }
    }
    // case 3: href scalar on previous line
    if (previousLineData.text.includes(hrefScalar)) {
        // get content for line above href
        const nameLine = currentLine - 2;
        const nameLineData = editor.document.lineAt(nameLine);
        // if nameLine starts with nameScalar check for cursor.  if equal, show quickpick.  if not, show error.
        if (nameLineData.text.includes(nameScalar)) {
            if (nameLineData.firstNonWhitespaceCharacterIndex === cursorPosition) {
                launchQuickPick(options);
            }
            else {
                vscode_1.window.showErrorMessage(log_messages_1.invalidTocEntryPosition);
                return;
            }
        }
    }
    // case 4: blank line
    if (previousLineData.isEmptyOrWhitespace) {
        // to-do: check with pm for this scenario
        common_1.showStatusMessage(`No previous entry and not at the top of the toc.`);
        return;
    }
}
exports.checkForPreviousEntry = checkForPreviousEntry;
function createParentNode() {
    const editor = vscode_1.window.activeTextEditor;
    if (!editor) {
        return;
    }
    const position = editor.selection.active;
    const cursorPosition = position.character;
    const attributeSpace = "  ";
    const indentedSpace = "    ";
    const parentNodeLineStart = `- name:
  items:
  - name:
    href:`;
    const parentNodeIndented = `- name:
  ${attributeSpace}items:
  ${attributeSpace}- name:
  ${indentedSpace}href:`;
    if (cursorPosition === 0) {
        common_1.insertContentToEditor(editor, insertTocEntry.name, parentNodeLineStart);
    }
    if (cursorPosition > 0) {
        common_1.insertContentToEditor(editor, insertTocEntry.name, parentNodeIndented);
    }
}
exports.createParentNode = createParentNode;
function launchQuickPick(options) {
    if (!options) {
        showQuickPick(false);
    }
    else {
        showQuickPick(true);
    }
}
exports.launchQuickPick = launchQuickPick;
//# sourceMappingURL=yaml-controller.js.map