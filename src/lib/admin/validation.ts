export function parseId(value: string | undefined): number | null {
    if (!value || !/^[1-9]\d*$/.test(value)) return null;

    const id = Number(value);
    return Number.isSafeInteger(id) ? id : null;
}
