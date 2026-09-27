import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Architecture rules, checked on every test run:
 *
 *   presentation → application → domain      (infrastructure implements domain/application ports)
 *   auth → users, content                    (bounded contexts depend in one direction)
 *
 * Only relative imports inside src/ and package imports are considered.
 */

const SRC = import.meta.dirname;
const LAYERS = [
  'domain',
  'application',
  'infrastructure',
  'presentation',
] as const;
type Layer = (typeof LAYERS)[number];

/** Which other bounded contexts a context's domain/application/infrastructure may use. */
const UPSTREAM: Record<string, readonly string[]> = {
  auth: ['users', 'content'],
  users: [],
  content: [],
};

/**
 * Packages the domain must never import. Of the workspace packages, it may only
 * use the framework-free @while-building/shared (e.g. AppError).
 */
const FRAMEWORK_PACKAGES =
  /^(@nestjs\/|typeorm$|express$|@node-rs\/|class-validator$|class-transformer$|cookie-parser$|pg$|node:|@while-building\/(?!shared$))/;
/** Technical packages that belong in infrastructure (or presentation), not application. */
const INFRASTRUCTURE_PACKAGES =
  /^(typeorm$|@nestjs\/typeorm$|@nestjs\/jwt$|express$|@node-rs\/|cookie-parser$|pg$|@while-building\/database$)/;

interface Location {
  module?: string;
  layer?: Layer;
}

interface SourceFile {
  /** Path relative to src/, with forward slashes. */
  path: string;
  /** Internal imports (relative to src/). */
  internal: string[];
  /** Package imports. */
  packages: string[];
}

const files = readSourceFiles();

function readSourceFiles(): SourceFile[] {
  const paths = walk(SRC).filter(
    (path) =>
      path.endsWith('.ts') &&
      !path.endsWith('.spec.ts') &&
      !path.endsWith('.d.ts'),
  );
  return paths.map((absolute) => {
    const source = readFileSync(absolute, 'utf8');
    const specifiers = [
      ...source.matchAll(
        /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]/g,
      ),
    ].map((match) => match[1] ?? match[2] ?? '');
    const internal: string[] = [];
    const packages: string[] = [];
    for (const specifier of specifiers) {
      if (specifier.startsWith('.')) {
        const target = resolve(dirname(absolute), specifier).replace(
          /\.js$/,
          '.ts',
        );
        if (target.startsWith(SRC)) internal.push(toSrcPath(target));
      } else {
        packages.push(specifier);
      }
    }
    return { path: toSrcPath(absolute), internal, packages };
  });
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function toSrcPath(absolute: string): string {
  return relative(SRC, absolute).split(sep).join('/');
}

function locate(path: string): Location {
  const [root, module, layer] = path.split('/');
  if (root !== 'modules') return {};
  return {
    module,
    layer: LAYERS.find((candidate) => candidate === layer),
  };
}

function violations(
  check: (file: SourceFile, from: Location) => string[],
): string[] {
  return files.flatMap((file) =>
    check(file, locate(file.path)).map((problem) => `${file.path}: ${problem}`),
  );
}

describe('architecture', () => {
  it('finds the source files', () => {
    expect(files.length).toBeGreaterThan(30);
  });

  it('keeps the domain framework-independent and free of outer layers', () => {
    const problems = violations((file, from) => {
      if (from.layer !== 'domain') return [];
      return [
        ...file.packages
          .filter((name) => FRAMEWORK_PACKAGES.test(name))
          .map((name) => `imports package "${name}"`),
        ...file.internal
          .filter((target) => locate(target).layer !== 'domain')
          .map((target) => `imports ${target}`),
      ];
    });
    expect(problems).toEqual([]);
  });

  it('keeps the application layer free of infrastructure and presentation', () => {
    const problems = violations((file, from) => {
      if (from.layer !== 'application') return [];
      return [
        ...file.packages
          .filter((name) => INFRASTRUCTURE_PACKAGES.test(name))
          .map((name) => `imports package "${name}"`),
        ...file.internal
          .filter((target) => {
            const layer = locate(target).layer;
            return layer === 'infrastructure' || layer === 'presentation';
          })
          .map((target) => `imports ${target}`),
      ];
    });
    expect(problems).toEqual([]);
  });

  it('makes bounded contexts depend in one direction only', () => {
    const problems = violations((file, from) => {
      const module = from.module;
      if (!module) return [];
      return file.internal
        .filter((target) => {
          const to = locate(target);
          if (!to.module || to.module === module) return false;
          if (UPSTREAM[module]?.includes(to.module)) return false;
          // Any module's HTTP layer may use auth's route authorization
          // (decorators, guards) and the authenticated-user type.
          const authPlumbing =
            to.module === 'auth' &&
            (to.layer === 'presentation' ||
              target.startsWith('modules/auth/application/dto/'));
          return !(from.layer === 'presentation' && authPlumbing);
        })
        .map((target) => `imports ${target}`);
    });
    expect(problems).toEqual([]);
  });

  it('keeps shared/ independent of the modules', () => {
    const problems = violations((file) =>
      file.path.startsWith('shared/')
        ? file.internal
            .filter((target) => target.startsWith('modules/'))
            .map((target) => `imports ${target}`)
        : [],
    );
    expect(problems).toEqual([]);
  });

  it('has no circular imports', () => {
    const graph = new Map(files.map((file) => [file.path, file.internal]));
    const cycles: string[] = [];
    const state = new Map<string, 'visiting' | 'done'>();

    const visit = (path: string, trail: string[]) => {
      if (state.get(path) === 'done') return;
      if (state.get(path) === 'visiting') {
        cycles.push([...trail.slice(trail.indexOf(path)), path].join(' → '));
        return;
      }
      state.set(path, 'visiting');
      for (const next of graph.get(path) ?? []) visit(next, [...trail, path]);
      state.set(path, 'done');
    };
    for (const path of graph.keys()) visit(path, []);

    expect(cycles).toEqual([]);
  });
});
