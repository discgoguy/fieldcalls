// Multiple-choice checklist tasks can have more than one option selected at
// once (e.g. "Bearing A" and "Bearing C" replaced, but not "Bearing B") --
// this needs N independent checkboxes, not a single radio-style choice.
// response_value is a single text column, so selections are encoded as a
// delimited string. "|" is used since it practically never appears in a
// normal option label, unlike commas.
const DELIMITER = '|';

export function parseMultiSelect(value) {
    if (!value) return [];
    return value.split(DELIMITER).map(v => v.trim()).filter(Boolean);
}

export function toggleMultiSelectValue(value, option, checked) {
    const current = parseMultiSelect(value);
    const idx = current.indexOf(option);
    if (checked) {
        if (idx === -1) current.push(option);
    } else if (idx !== -1) {
        current.splice(idx, 1);
    }
    return current.join(DELIMITER);
}

export function isOptionSelected(value, option) {
    return parseMultiSelect(value).includes(option);
}
