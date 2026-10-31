// infohub.js on the login page (rendered by tests/test_js.py): „Покажи“ and the Caps Lock warning.
// Usage: node login.test.js <static folder> <pages folder>
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const src = fs.readFileSync(path.resolve(process.argv[2], "js/infohub.js"), "utf8");
const html = fs.readFileSync(path.join(path.resolve(process.argv[3]), "login.html"), "utf8").replace(/<script src=[^>]*><\/script>/g, "");
let passed = 0, failed = [];
function check(name, ok, detail) {
    if (ok) { passed++; console.log("OK   " + name); }
    else { failed.push(name); console.log("FAIL " + name + (detail !== undefined ? "  -> " + JSON.stringify(detail) : "")); }
}

const dom = new JSDOM(html, { runScripts: "outside-only", url: "http://testserver/login/" });
const w = dom.window, d = w.document;
w.eval(src);
const field = d.getElementById("id_password"), toggle = d.querySelector("[data-password-toggle]"), caps = d.querySelector("[data-caps-warning]");

check("the button is shown by the script", !toggle.hidden);
check("hidden password at first", field.type === "password" && toggle.textContent === "Покажи" && toggle.getAttribute("aria-pressed") === "false");
toggle.click();
check("„Покажи“ shows it", field.type === "text" && toggle.textContent === "Скрий" && toggle.getAttribute("aria-pressed") === "true");
check("the cursor stays in the field", d.activeElement === field);
toggle.click();
check("„Скрий“ hides it again", field.type === "password" && toggle.textContent === "Покажи");

// state = what the browser reports for Caps Lock (null: like the user's PC, it reports nothing)
function key(type, k, { shift = false, state = null, target = field } = {}) {
    const e = type === "mousedown" ? new w.MouseEvent(type, { bubbles: true, shiftKey: shift })
        : new w.KeyboardEvent(type, { key: k, shiftKey: shift, bubbles: true });
    e.getModifierState = (name) => name === "CapsLock" && state === true;
    target.dispatchEvent(e);
}
const username = d.querySelector("input[name=username]");
check("no Caps Lock warning at first", caps.hidden);
for (const k of "SDA") key("keydown", k, { target: username });
check("„SDA“ typed without Shift in the login name, nothing reported: warning", !caps.hidden);
key("keydown", "s", { target: username });
check("a small letter without Shift: gone", caps.hidden);
key("keydown", "a", { shift: true });
check("a small letter with Shift (Caps Lock + Shift): warning", !caps.hidden);
key("keydown", "A", { shift: true });
check("a capital with Shift: no warning", caps.hidden);
key("keydown", "Ж");
check("Cyrillic capital without Shift: warning", !caps.hidden);
key("keydown", "7");
key("keydown", "Backspace");
check("digits and other keys change nothing", !caps.hidden);
key("keydown", "ж");
check("Cyrillic small: gone", caps.hidden);
key("keyup", "CapsLock", { state: true });
check("the Caps Lock key, reported on: warning at once", !caps.hidden);
key("keyup", "CapsLock", { state: false });
check("the Caps Lock key, reported off: gone", caps.hidden);
key("mousedown", "", { state: true, target: d.body });
check("a click, reported on: warning", !caps.hidden);
key("keydown", "a");

toggle.click();
field.form.dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
check("sent as a password field (password managers)", field.type === "password" && toggle.textContent === "Покажи");

console.log(failed.length ? `${failed.length} FAILED of ${passed + failed.length}` : `${passed}/${passed} passed`);
process.exit(failed.length ? 1 : 0);
