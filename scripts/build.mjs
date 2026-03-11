import fs from 'fs'
import process from 'process';
import * as child from 'child_process'
console.log('> Copying src to dist')
child.execSync('rm -rf dist   && cp -R src dist')

console.log('> tsc')
const minify=false

const ansiRegex = /\u001b\[[0-9;]*m/g;

const remapDistPath = (text) => {
    if (!text) return text;
    const clean = text.replace(ansiRegex, '');
    return clean
        .replace(/dist[\\/](.+?):(\d+):(\d+)/g, 'src/$1:$2:$3')
        .replace(/dist[\\/](.+?):(\d+)/g, 'src/$1:$2')
        .replace(/dist[\\/](.+?)\((\d+),(\d+)\)/g, 'src/$1:$2:$3')
        .replace(/([\\/])dist([\\/])/g, '$1src$2');
};

const pipeWithRemap = (stream, writer) => {
    let buffer = '';
    const FLUSH_THRESHOLD = 8192;
    const TAIL_KEEP = 64;
    stream.on('data', (chunk) => {
        buffer += chunk;
        if (buffer.length > FLUSH_THRESHOLD) {
            const flushPart = buffer.slice(0, buffer.length - TAIL_KEEP);
            buffer = buffer.slice(buffer.length - TAIL_KEEP);
            writer(remapDistPath(flushPart));
        }
    });
    stream.on('end', () => {
        if (buffer.length > 0) {
            writer(remapDistPath(buffer));
        }
    });
};

function postBuild(){
    const packageJson=JSON.parse(fs.readFileSync('package.json'))
    delete packageJson.private
    delete packageJson.files
    delete packageJson.prepublish
    delete packageJson.scripts
    delete packageJson.packageManager
    packageJson.main="index.js"
    // show only typescript as dev dependency
    if(packageJson.devDependencies && packageJson.devDependencies.typescript ){
        packageJson.devDependencies={typescript:packageJson.devDependencies.typescript}
    }
    fs.writeFileSync('dist/package.json',JSON.stringify(packageJson,null,2))
    child.execSync('cp -f ./README.md ./dist/README.md')
}
const tsc = child.spawn('./node_modules/.bin/tsc', ["-p","./tsconfig.build.json","--pretty","false"],{stdio: ['ignore', 'pipe', 'pipe']})
tsc.stdout.setEncoding('utf8')
tsc.stderr.setEncoding('utf8')
pipeWithRemap(tsc.stdout, (data) => process.stdout.write(data))
pipeWithRemap(tsc.stderr, (data) => process.stderr.write(data))
tsc
    .once('exit',(code)=>{
        if(code ==0){
            if (minify) {
                console.log('> esbuild')
                child.spawn('./node_modules/.bin/esbuild', ['./dist/index.js', '--minify', '--outfile=./dist/index.js', '--allow-overwrite']
                    , {stdio: [process.stdin, process.stdout, process.stderr]})
                    .once('exit', (code) => {
                        if (code == 0) {
                            postBuild()
                        } else {
                            process.exit(code)
                        }
                    })
            }
            else {
                postBuild()
            }
        }else{
            process.exit(code)
        }
    })
