import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { QueryKeys } from '@/state/query/queryKeys';
import {
  holdsStreamCredentials,
  playableResourceKey,
} from '@/features/song/playableResourcePersistence';

const rootLayout = readFileSync(join(__dirname, '..', '..', 'app', '_layout.tsx'), 'utf8');

describe('what the resolver writes and what disk is allowed to see', () => {
  it('recognises the key it builds', () => {
    // Deliberately through the builder rather than a literal: these two
    // functions disagreeing is the whole failure mode, and a literal here
    // would still pass while they did.
    expect(holdsStreamCredentials(playableResourceKey('server-1', 'song-1'))).toBe(true);
  });

  it('recognises it with no active server, which is how it is keyed before one is chosen', () => {
    expect(holdsStreamCredentials(playableResourceKey(undefined, 'song-1'))).toBe(true);
  });

  it('leaves every other query alone', () => {
    expect(holdsStreamCredentials([QueryKeys.Album, 'server-1', 'album-1'])).toBe(false);
    expect(holdsStreamCredentials([QueryKeys.Tracks, 'server-1'])).toBe(false);
    expect(holdsStreamCredentials([])).toBe(false);
  });

  it('keys by server, so one server\'s URL is not served for another', () => {
    expect(playableResourceKey('server-1', 'song-1'))
      .not.toEqual(playableResourceKey('server-2', 'song-1'));
  });
});

/**
 * The predicate is inert on its own — it has to be composed into the
 * persister's options to stop anything being written, and called again after
 * hydration to clear what an older blob restored. Neither is visible from the
 * module under test, and a type checker cannot see an unused predicate as a
 * problem, so this reads the layout's source the way
 * `externalResolutionMount.test.ts` does.
 */
describe('the root layout wires it in', () => {
  it('excludes credentialled queries from what the persister dehydrates', () => {
    expect(rootLayout).toMatch(/shouldDehydrateQuery:[\s\S]*?!holdsStreamCredentials\(query\.queryKey\)/);
  });

  it('clears credentialled queries that hydration restored', () => {
    expect(rootLayout).toMatch(/onSuccess=\{[\s\S]*?removeQueries\([\s\S]*?holdsStreamCredentials/);
  });

  it('still excludes the catalog, which shares the same predicate chain', () => {
    expect(rootLayout).toMatch(/!isCatalogQuery\(query\.queryKey\)/);
  });
});
