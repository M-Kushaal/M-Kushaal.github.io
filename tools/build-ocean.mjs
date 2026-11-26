import { build } from 'esbuild';
import { resolveShader } from '@vgpu/wgsl/runtime';
import { prepareShader } from '@vgpu/wgsl/prepare';

await build({
  entryPoints: ['effects/fft-ocean/home.ts'],
  outfile: 'assets/ocean-home.js',
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  legalComments: 'eof',
  plugins: [{
    name: 'prepared-wgsl',
    setup(build) {
      build.onLoad({filter: /\.wgsl$/}, async ({path}) => {
        const resolved = await resolveShader({entry:path, validate:false, minify:true});
        const shader = prepareShader(resolved.wgsl, path);
        return {contents:`export default ${JSON.stringify(shader)};`, loader:'js'};
      });
    }
  }],
  logLevel:'info'
});
