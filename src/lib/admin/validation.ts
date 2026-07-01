export function parseId(value: string | undefined): number | null {
    const id = Number.parseInt(value ?? "", 10);
    return Number.isInteger(id) && id > 0 ? id : null;
}
