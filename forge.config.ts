import type { ForgeConfig } from '@electron-forge/shared-types';
import fs from 'node:fs/promises';
import path from 'node:path';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerDeb } from '@electron-forge/maker-deb';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import { mainConfig } from './webpack.main.config';
import { rendererConfig } from './webpack.renderer.config';

const sharpRuntimePackages = [
  'sharp',
  'detect-libc',
  'semver',
  path.join('@img', 'colour'),
  path.join('@img', 'sharp-win32-x64')
];

async function copySharpRuntime(
  _forgeConfig: unknown,
  buildPath: string,
  _electronVersion: string,
  platform: string,
  arch: string
): Promise<void> {
  if (platform !== 'win32' || arch !== 'x64') {
    throw new Error(`Sharp packaging is only configured for win32-x64, not ${platform}-${arch}.`);
  }

  for (const packagePath of sharpRuntimePackages) {
    await fs.cp(
      path.resolve('node_modules', packagePath),
      path.resolve(buildPath, 'node_modules', packagePath),
      { recursive: true }
    );
  }
}

const config: ForgeConfig = {
  packagerConfig: {
    asar: {
      unpack: '**/{.**,**}/**/*.{node,dll}'
    }
  },
  rebuildConfig: {},
  hooks: {
    packageAfterPrune: copySharpRuntime
  },
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({}),
    new MakerDeb({})
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new WebpackPlugin({
      mainConfig,
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            html: './src/index.html',
            js: './src/renderer.ts',
            name: 'main_window',
            preload: {
              js: './src/preload.ts'
            }
          }
        ]
      }
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true
    })
  ]
};

export default config;
