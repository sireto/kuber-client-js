const fs = require('fs')
const process = require("process")
const child = require("child_process");
console.log('> tsc')
const minify=false

function postBuild(){
    const packageJson=JSON.parse(fs.readFileSync('package.json'))
    delete packageJson.private
    delete packageJson.files
    delete packageJson.prepublish
    delete packageJson.scripts
    packageJson.main="index.js"
    // show only typescript as dev dependency
    if(packageJson.devDependencies && packageJson.devDependencies.typescript ){
        packageJson.devDependencies={typescript:packageJson.devDependencies.typescript}
    }
    fs.writeFileSync('dist/package.json',JSON.stringify(packageJson,null,2))
    fs.writeFileSync('dist/.npmignore', 'tests/')
    child.execSync('cp -f ./README.md ./dist/README.md')
}
child.spawn('./node_modules/.bin/tsc', ["-p","./tsconfig.json"],{stdio: [process.stdin, process.stdout, process.stderr]})
    .once('exit',(code)=>{
        if(code ==0){
            console.log('> esbuild')
            if (minify) {
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