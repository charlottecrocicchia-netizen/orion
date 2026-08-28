/** Les routes de la chaîne de l'argent, partagées entre le focus
 *  analytique et la Constellation Trace. Un appel atteint depuis un
 *  programme reste CADRÉ sur lui (`?programme=`) — la vue scoped est
 *  reproductible par l'URL. */

export function crumbPath(node: { level: string; id: number | string }): string {
  return `/money/${node.level}/${node.id}`;
}

export function childTo(
  item: { level: string; id: number | string },
  parent?: { level: string; id: number | string },
): string {
  if (item.level === "call" && parent?.level === "programme") {
    return `/money/call/${item.id}?programme=${parent.id}`;
  }
  return crumbPath(item);
}
