// A polling fake has no work left if its owner or working directory disappears.
export const fileBarrierCode = `const fs=require('fs');const owner=process.ppid,root=process.cwd();const timer=setInterval(()=>{if(owner===1||process.ppid!==owner||!fs.existsSync(root)||fs.existsSync('finish'))clearInterval(timer)},50)`;
export const fileBarrierCommand = `node -e "${fileBarrierCode}"`;
