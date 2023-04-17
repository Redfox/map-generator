import createGraph from 'ngraph.graph';
import PoissonDiskSampling from 'poisson-disk-sampling';
import Delaunator from 'delaunator';
import ngrahPath from 'ngraph.path';
import { createCanvas } from 'canvas';
import fs from 'fs';

let canvasSize = { w: 500, h: 500 };
let graph = createGraph();

let p = new PoissonDiskSampling({
    shape: [canvasSize.w * 0.9, canvasSize.h * 0.9],
    minDistance: 40,
    maxDistance: 80,
    tries: 20
}, Math.random);

let startPoint = [canvasSize.w * 0.5, canvasSize.h * 0.89]
let endPoint = [canvasSize.w * 0.45, 15]

p.addPoint(startPoint)
p.addPoint(endPoint)

function hypot(x, y, z) {
    // Use the native implementation if it's available
    if (typeof Math.hypot === 'function') {
        return Math.hypot.apply(null, arguments);
    }

    // Otherwise use the V8 implementation
    // https://github.com/v8/v8/blob/8cd3cf297287e581a49e487067f5cbd991b27123/src/js/math.js#L217
    const length = arguments.length;
    const args = [];
    let max = 0;
    for (let i = 0; i < length; i++) {
        let n = arguments[i];
        n = +n;
        if (n === Infinity || n === -Infinity) {
            return Infinity;
        }
        n = Math.abs(n);
        if (n > max) {
            max = n;
        }
        args[i] = n;
    }

    if (max === 0) {
        max = 1;
    }
    let sum = 0;
    let compensation = 0;
    for (let j = 0; j < length; j++) {
        const m = args[j] / max;
        const summand = m * m - compensation;
        const preliminary = sum + summand;
        compensation = preliminary - sum - summand;
        sum = preliminary;
    }
    return Math.sqrt(sum) * max;
}

const dist = function(...args) {
    if (args.length === 4) {
        //2D
        return hypot(args[2] - args[0], args[3] - args[1]);
    } else if (args.length === 6) {
        //3D
        return hypot(args[3] - args[0], args[4] - args[1], args[5] - args[2]);
    }
};

let points = p.fill().filter(p => {
    return dist(...p, canvasSize.w * 0.45, canvasSize.h * 0.45) <= canvasSize.w * 0.45
});

const delaunay = Delaunator.from(points).triangles;
let triangles = [];
for (let i = 0; i < delaunay.length; i += 3) {
    triangles.push([
        points[delaunay[i]],
        points[delaunay[i + 1]],
        points[delaunay[i + 2]]
    ])
}
for (let t of triangles) {
    graph.addLink(t[0], t[1], {
        weight: dist(...t[0], ...t[1])
    })
    graph.addLink(t[1], t[2], {
        weight: dist(...t[1], ...t[2])
    })
    graph.addLink(t[2], t[0], {
        weight: dist(...t[2], ...t[0])
    })
}

let nodes = []
graph.forEachNode(function(node){
    nodes.push(node.id);
});

let activePoints = [];
let arrows = [];
for (let i = 0; i < canvasSize.w / 50; i++) {
    const pathFinder = ngrahPath.aStar(graph, {
        distance(fromNode, toNode, link) {
            return link.data.weight;
        }
    });

    const foundPath = pathFinder.find(startPoint, endPoint);
    if (foundPath.length === 0) {
        break;
    }

    activePoints.push(...foundPath.map(obj => obj.id))

    for (let j = 1; j < foundPath.length; j++) {
        arrows.push([...foundPath[j].id, ...foundPath[j - 1].id])
    }

    const max = foundPath.length - 1
    const min = 1
    const idx = Math.floor(Math.random() * ((max - 1) - min + 1) + min);
    graph.removeNode(foundPath[idx].id);
}

const canvas = createCanvas(canvasSize.w, canvasSize.h);
const ctx = canvas.getContext('2d');
ctx.fillStyle = "#764abc";
ctx.fillRect(0, 0, canvasSize.w, canvasSize.h);

for (const p of new Set(activePoints)) {
    if (p[0] === 225 && p[1] === 15) {
        ctx.fillStyle = 'red';
        ctx.beginPath();
        ctx.arc(p[0], p[1], 5, 0, 2 * Math.PI);
        ctx.fill();
    } else if (p[0] === 250 && p[1] === 445) {
        ctx.fillStyle = 'blue';
        ctx.beginPath();
        ctx.arc(p[0], p[1], 5, 0, 2 * Math.PI);
        ctx.fill();
    } else {
        ctx.fillStyle = '#0000';
        ctx.beginPath();
        ctx.arc(p[0], p[1], 5, 0, 2 * Math.PI);
        ctx.stroke();
    }
}

for (const p of new Set(arrows)) {
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    ctx.lineTo(p[2], p[3]);
    ctx.stroke();
}

// Write the image to file
const buffer = canvas.toBuffer("image/png");
fs.writeFileSync("./image.png", buffer);
