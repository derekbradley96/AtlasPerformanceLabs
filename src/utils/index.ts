/** Route paths are lowercase; page keys stay PascalCase. */
export function createPageUrl(pageName: string) {
    return '/' + pageName.replace(/ /g, '-').toLowerCase();
}