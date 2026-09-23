/**
 * Small JSON patch implementation shared by the Socket.io server and client.
 *
 * The room state only contains JSON-compatible values. Keeping this protocol
 * deliberately small makes it easy to validate, test and fall back to a full
 * snapshot whenever a patch would not be cheaper.
 */

export type RoomPatchPath = Array<string | number>;

export type RoomPatchOperation =
  | { op: 'set'; path: RoomPatchPath; value: unknown }
  | { op: 'delete'; path: RoomPatchPath };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Clone exactly what Socket.io will serialize (undefined properties omitted). */
export function cloneRoomJson<T>(value: T): T {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new Error('Room state must be JSON serializable');
  }
  return JSON.parse(serialized) as T;
}

function diffValue(
  previous: unknown,
  next: unknown,
  path: RoomPatchPath,
  operations: RoomPatchOperation[],
): void {
  if (Object.is(previous, next)) return;

  if (Array.isArray(previous) && Array.isArray(next)) {
    // Replacing a resized array avoids index-shift ambiguity. Arrays with a
    // stable shape (teams, brackets, players) are diffed item by item.
    if (previous.length !== next.length) {
      operations.push({ op: 'set', path, value: next });
      return;
    }
    for (let index = 0; index < next.length; index += 1) {
      diffValue(previous[index], next[index], [...path, index], operations);
    }
    return;
  }

  if (isPlainObject(previous) && isPlainObject(next)) {
    for (const key of Object.keys(previous)) {
      if (!Object.prototype.hasOwnProperty.call(next, key)) {
        operations.push({ op: 'delete', path: [...path, key] });
      }
    }
    for (const key of Object.keys(next)) {
      if (!Object.prototype.hasOwnProperty.call(previous, key)) {
        operations.push({ op: 'set', path: [...path, key], value: next[key] });
      } else {
        diffValue(previous[key], next[key], [...path, key], operations);
      }
    }
    return;
  }

  operations.push({ op: 'set', path, value: next });
}

export function diffRoomJson(previous: unknown, next: unknown): RoomPatchOperation[] {
  const operations: RoomPatchOperation[] = [];
  diffValue(previous, next, [], operations);
  return operations;
}

function isSafePathSegment(segment: string | number): boolean {
  return segment !== '__proto__' && segment !== 'prototype' && segment !== 'constructor';
}

function isContainer(value: unknown): value is Record<string, unknown> | unknown[] {
  return Array.isArray(value) || isPlainObject(value);
}

function getParent(root: unknown, path: RoomPatchPath): { parent: Record<string, unknown> | unknown[]; key: string | number } {
  if (path.length === 0) throw new Error('Root path has no parent');

  let current: unknown = root;
  for (const segment of path.slice(0, -1)) {
    if (!isSafePathSegment(segment) || !isContainer(current)) {
      throw new Error('Invalid room patch path');
    }
    if (Array.isArray(current)) {
      if (typeof segment !== 'number' || !Number.isInteger(segment) || segment < 0 || segment >= current.length) {
        throw new Error('Invalid room patch array path');
      }
      current = current[segment];
    } else {
      if (typeof segment !== 'string' || !Object.prototype.hasOwnProperty.call(current, segment)) {
        throw new Error('Invalid room patch object path');
      }
      current = current[segment];
    }
  }

  const key = path[path.length - 1];
  if (!isSafePathSegment(key) || !isContainer(current)) {
    throw new Error('Invalid room patch target');
  }
  if (Array.isArray(current) && (typeof key !== 'number' || !Number.isInteger(key) || key < 0 || key >= current.length)) {
    throw new Error('Invalid room patch array target');
  }
  if (!Array.isArray(current) && typeof key !== 'string') {
    throw new Error('Invalid room patch object target');
  }
  return { parent: current, key };
}

export function applyRoomPatch<T>(source: T, operations: readonly RoomPatchOperation[]): T {
  // Patches are intentionally small, but room state contains the complete
  // competition history. Cloning the whole room for every tiny update made
  // the browser spend more time in JSON serialization as rounds accumulated.
  // Copy only the containers along each changed path; untouched subtrees keep
  // their references and remain immutable because every ancestor we modify is
  // copied first.
  let root = source as unknown;

  for (const operation of operations) {
    if (!operation || !Array.isArray(operation.path)) throw new Error('Invalid room patch operation');
    if (operation.path.length === 0) {
      if (operation.op !== 'set') throw new Error('Cannot delete room root');
      root = cloneRoomJson(operation.value);
      continue;
    }

    root = cloneContainersAlongPath(root, operation.path);
    const { parent, key } = getParent(root, operation.path);
    if (operation.op === 'set') {
      if (Array.isArray(parent)) parent[key as number] = cloneRoomJson(operation.value);
      else parent[key as string] = cloneRoomJson(operation.value);
    } else if (operation.op === 'delete') {
      if (Array.isArray(parent)) throw new Error('Cannot delete an indexed room array item');
      delete parent[key as string];
    } else {
      throw new Error('Unknown room patch operation');
    }
  }

  return root as T;
}

function cloneContainer(value: Record<string, unknown> | unknown[]): Record<string, unknown> | unknown[] {
  return Array.isArray(value) ? value.slice() : { ...value };
}

/** Copy only the ancestors that a patch is about to traverse or modify. */
function cloneContainersAlongPath(root: unknown, path: RoomPatchPath): unknown {
  if (!isContainer(root)) throw new Error('Invalid room patch root');

  const clonedRoot = cloneContainer(root);
  let originalCurrent: Record<string, unknown> | unknown[] = root;
  let clonedCurrent: Record<string, unknown> | unknown[] = clonedRoot;

  for (const segment of path.slice(0, -1)) {
    if (!isSafePathSegment(segment)) throw new Error('Invalid room patch path');

    let child: unknown;
    if (Array.isArray(originalCurrent)) {
      if (typeof segment !== 'number' || !Number.isInteger(segment)
        || segment < 0 || segment >= originalCurrent.length) {
        throw new Error('Invalid room patch array path');
      }
      child = originalCurrent[segment];
    } else {
      if (typeof segment !== 'string' || !Object.prototype.hasOwnProperty.call(originalCurrent, segment)) {
        throw new Error('Invalid room patch object path');
      }
      child = originalCurrent[segment];
    }

    if (!isContainer(child)) throw new Error('Invalid room patch container path');
    const clonedChild = cloneContainer(child);
    if (Array.isArray(clonedCurrent)) clonedCurrent[segment as number] = clonedChild;
    else clonedCurrent[segment as string] = clonedChild;
    originalCurrent = child;
    clonedCurrent = clonedChild;
  }

  return clonedRoot;
}
