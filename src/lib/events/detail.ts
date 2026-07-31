export interface EventDetailOptionalFields {
    description?: string | null;
    address?: string | null;
    qq_group?: string | null;
    ticket_url?: string | null;
    source_url?: string | null;
}

function optionalText(value: string | null | undefined) {
    return value?.trim() || null;
}

export function getEventDetailOptionalContent(event: EventDetailOptionalFields) {
    const description = optionalText(event.description);
    const address = optionalText(event.address);
    const qqGroup = optionalText(event.qq_group);
    const ticketUrl = optionalText(event.ticket_url);
    const sourceUrl = ticketUrl ? null : optionalText(event.source_url);
    const hasAction = Boolean(ticketUrl || sourceUrl);
    const hasAsideContent = Boolean(hasAction || address || qqGroup);

    return {
        description,
        address,
        qqGroup,
        ticketUrl,
        sourceUrl,
        hasAction,
        hasAsideContent,
        hasOptionalContent: Boolean(description || hasAsideContent)
    };
}
