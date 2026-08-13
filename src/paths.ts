import path from 'node:path';

export function isPathInside(rootDirectory: string, candidatePath: string): boolean {
  const relativePath = path.relative(
    path.resolve(rootDirectory),
    path.resolve(candidatePath)
  );

  return relativePath === '' || (
    relativePath !== '..' &&
    !relativePath.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativePath)
  );
}
