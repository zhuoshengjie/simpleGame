// 定义关卡地形图
/*
句点为空气，哈希为墙，加号为熔岩。
玩家的起使位置是@符号。每个o字符都是一个硬币，
=是一块水平来回移动的熔岩块
|表示垂直移动的熔岩，v表示滴落的熔岩
整个游戏包含玩家必须完成的多个关卡。收集完某一关的所有硬币后，就闯过这一关。
如果玩家碰到熔岩，则闯关失败，当前关卡恢复到其起使位置，而玩家可以重新再来
*/
let simpleLevelPlan = `
......................
..#................#..
..#..............=.#..
..#.........o.o....#..
..#.@......#####...#..
..#####............#..
......#++++++++++++#..
......##############..
......................`
// 储存关卡对象
class Level {
    constructor(plan) {
        let rows = plan.trim().split("\n").map(l => [...l])
        this.height = rows.length
        this.width = rows[0].length
        this.startActors = []
        this.rows = rows.map((row, y) => {
            return row.map((ch, x) => {
                let type = levelChars[ch]
                if(typeof type == "string") return type
                this.startActors.push(type.create(new Vec(x, y), ch))
                return "empty"
            })
        })
    }
}
/**
 * 定义矢量对象
 * times 方法按给定数量缩放矢量。
 * 当我们需要将速度矢量乘以时间间隔以获得在此期间行进的距离时，它将非常有用
 */
class Vec {
    constructor(x,y) {
        this.x = x
        this.y = y
    }
    plus(other) {
        return new Vec(this.x + other.x, this.y + other.y)
    }
    times(factor) {
        return new Vec(this.x * factor, this.y * factor)
    }
}
/* 
随着游戏的运行，演员将在不同的地方结束，甚至完全消失（如硬币被收集时）。
使用state类来跟踪正在运行的游戏的状态
游戏结束后，status属性将切换为"lost"或"won"
这又是一个持久的数据结构，更新游戏状态会创建一个新状态并使旧状态保持不变
*/
class State {
    constructor(level, actors, status) {
        this.level = level
        this.actors = actors
        this.status = status
    }
    static start(level) {
        return new State(level, level.startActors, "playing")
    }
    get player() {
        return this.actors.find(a => a.type == "player")
    }
}
// 演员
/**
 * 演员对象代表我们游戏中给定的可移动元素当前位置和状态。
 * 所有演员对象都符合相同的接口。
 * 其pos属性保存相对元素左上角的坐标，size属性保存其大小
 * 然后他们有一个update方法，用于计算给定时间步后的新状态和位置。
 * 它模拟演员所做的事情——响应玩家按下的方向键并围绕熔岩来回弹跳，并返回一个新的、更新后的演员对象
 * type属性包含一个字符串，用于标识演员的类型——"player""coin""lava(熔岩)"
 * 演员类具有静态create方法，level构造函数使用此方法从关卡地形图中的角色创建演员，它被赋予角色的坐标和角色本身。
 */

/**
 * 因为不同类型的演员行为非常不同，
 * 所以它们都有自己的类。
 * Player类具有属性speed,可存储 其当前速度以模拟动量和重力
 */
/**
 * 因为玩家的高度是半个正方形高，所以它的初始位置设置为"@"字符所出现位置的上方的半个方格。
 * 这样他的底部正好对齐
 * 对于player的所有实例，size属性都是相同的，因此我们将其存储在原型而不是实例本身上。
 * 我们可以使用类似于type的取值方法，但每次读取属性时都会创建并返回一个新的Vec对象，
 * 这将是浪费（字符串是不可变的，不必在每次计算时重新创建）
 */
class Player {
    constructor(pos, speed) {
        this.pos = pos
        this.speed = speed
    }
    get type() {
        return "player"
    }
    static create(pos) {
        return new Player(pos.plus(new Vec(0, -0.5)), new Vec(0, 0))
    }
}
Player.prototype.size = new Vec(0.8, 1.5)

/**
 * 构造lava演员时，我们需要根据它所基于的角色来不同地初始化对象。
 * 动态熔岩以其当前速度移动，直到遇到障碍物。此时，如果它具有reset属性，它将回到其起使位置（滴落）
 * 如果没有此属性，它将反转其速度并继续向另一个方向移动
 * create方法查看level构造函数传递的字符并创建相应的熔岩演员
 */

class Lava {
    constructor(pos, speed, reset) {
        this.pos = pos
        this.speed = speed
        this.reset = reset
    }
    get type() {
        return "lava"
    }
    static create(pos, ch) {
        if(ch == "=") {
            return new Lava(pos, new Vec(2, 0))
        }else if(ch == "|") {
            return new Lava(pos, new Vec(0, 2))
        }else if(ch == "v") {
            return new Lava(pos, new Vec(0, 3), pos)
        }
    }
}
Lava.prototype.size = new Vec(1, 1)

/**
 * Coin演员相对简单。它们大多只是呆在它们的位置上不动
 * 但为了让游戏稍微活跃一些，我们会让它们"振动（wobble)"——轻微地垂直往复运动。
 * 为了实现这一点，硬币对象在存储基本位置的同时还存储跟踪弹跳运动阶段的wobble属性。
 * 它们共同决定硬币的实际位置（存储在pos属性中）
 * 
 * Math.sin为我们提供了圆上一个点的y坐标。当我们沿圆周移动时，该坐标以平滑的波形来回变化
 * 这使得正弦函数可用于模拟波浪运动。为了避免出现所有硬币都同步上下移动的情况，
 * 每个硬币的起始阶段是随机的。Math.sin波形的相位，即它产生的波的宽度是2派。我们用这个
 * 数字乘以Math.random的返回值为硬币在波形上指定一个随机的起使位置
 */
class Coin {
    constructor(pos, basePos, wobble) {
        this.pos = pos
        this.basePos = basePos
        this.wobble = wobble
    }
    get type() {
        return "coin"
    }
    static create(pos) {
        let basePos = pos.plus(new Vec(0.2, 0.1))
        return new Coin(basePos, basePos, Math.random() * Math.PI * 2)
    }
}

Coin.prototype.size = new Vec(0.6, 0.6)

/**
 * 定义levelChars对象将地形图字符映射到背景网格类型或演员类
 */

const levelChars = {
    '.': 'empty', 
    '#': 'wall',
    '+': 'lava',
    '@': Player,
    'o': Coin,
    '=': Lava,
    '|': Lava,
    'v': Lava
}

// 以上已经完成了Level实例所需的所有部分

// 可以创建lava实例了
// let simpleLevel = new Level(simpleLevelPlan)
// console.log(`${simpleLevel.width} by ${simpleLevel.height}`)


// 此方法告诉我们矩形（由位置和大小指定）是否会碰到给定类型的网格元素
Level.prototype.touches = function(pos, size, type) {
    var xStart = Math.floor(pos.x)
    var xEnd = Math.ceil(pos.x + size.x)
    var yStart = Math.floor(pos.y)
    var yEnd = Math.ceil(pos.y + size.y)

    for(var y=yStart; y<yEnd; y++) {
        for(var x=xStart; x<xEnd; x++) {
            let isOutside = x < 0 || x >= this.width || y < 0 || y >= this.height
            let here = isOutside ? "wall" : this.rows[y][x]
            if(here == type) return true
        }
    }
    return false
}
// 此方法通过在其坐标上使用Math.floor和Math.ceil来计算与玩家身体重叠的网格方块集合
// 请记住，网格方块的大小为1乘1。通过对矩形的两侧四舍五入，我们就得到了与这个矩形接触的
// 背景方块的范围
/**
 * 我们遍历通过舍入坐标找到的网格方块，并在找到匹配的方块时返回true。关卡之外的正方形总是被视为“墙”,
 * 以确保玩家不会离开这个世界，并且我们不会意外地尝试在我们地rows数组的边界之外读取。
 * 
*/

/*
 * 状态的update方法使用touches来确定玩家是否碰到熔岩
 */
State.prototype.update = function(time, keys) {
    let actors = this.actors.map(actor => actor.update(time, this, keys))
    let newState = new State(this.level, actors, this.status)

    if(newState.status != 'playing') return newState

    let player = newState.player

    if(this.level.touches(player.pos, player.size, 'lava')) {
        return new State(this.level, actors, "lost")
    }

    for (let actor of actors) {
        if(actor != player && overlap(actor, player)) {
            newState = actor.collide(newState)
        }
    }
    return newState
}

/**
 * 此方法通过一个时间片段和一个数据结构，告诉它哪些键被按下。
 * 它做的第一件事是在所有演员身上调用update方法，造出一系列更新的演员。
 * 演员也得到了时间片段、键和状态，以便它们可以根据这些进行更新。只有玩家才能真正读取键，
 * 因为这是唯一用键盘控制的演员
 * 
 * 如果游戏已经结束，则不需要进行进一步处理（游戏在输掉后无法赢，反之亦然）。否则，
 * 此方法测试玩家是否碰到背景熔岩。如果碰到，游戏就会输掉，我们就结束了。
 * 最后，如果游戏真的还在继续，他会看到是否有其他演员与玩家重叠。
 */

/**
 * 使用overlap函数检测演员之间的重叠。它需要两个演员对象，并且当它们碰到时返回true,
 * 当它们沿着x轴和沿y轴重叠时就是这种情况
 */

function overlap(actor1, actor2) {
    return actor1.pos.x + actor1.size.x > actor2.pos.x &&
           actor1.pos.x < actor2.pos.x + actor2.size.x &&
           actor1.pos.y + actor1.size.y > actor2.pos.y &&
           actor1.pos.y < actor2.pos.y + actor2.size.y
}

/**
 * 如果有任何演员真的重叠了，则其collide方法有机会更新状态。碰到熔岩演员就将游戏状态设置
 * 为“Lost"。碰到硬币时它们就消失，当碰到的是关卡的最后一枚硬币时，就将状态设置为”won"
 */

Lava.prototype.collide = function(state) {
    return new State(state.level, state.actors, 'lost')
}
Coin.prototype.collide = function(state) {
    // 碰到就过滤掉这个，效果就是显示时去掉这个，即这个碰到了就消失
    let filtered = state.actors.filter(a => a != this)
    let status = state.status
    if(!filtered.some(a => a.type == 'coin')) status = "won"
    return new State(state.level, filtered, status)
}

/**
 * 演员对象的update方法将时间片段、状态对象和键对象作为参数。
 * Lava演员类型的update忽略了keys对象
 */

/**
 * 此update方法通过将时间片段和当前速度的乘积加上其原位置来计算新位置。
 * 如果没有障碍物阻挡那个新位置，他就会移动到那里，如果存在障碍物，则行为取决于熔岩块的类型————滴落的熔岩具有reset位置
 * 当它碰到物体时会从起使位置重新开始。弹跳熔岩通过将其速度乘以-1来反转，使其开始向相反方向移动
 */

Lava.prototype.update = function(time, state) {
    let newPos = this.pos.plus(this.speed.times(time))
    if(!state.level.touches(newPos, this.size, "wall")) {
        return new Lava(newPos, this.speed, this.reset)
    } else if(this.reset) {
        return new Lava(this.reset, this.speed, this.reset)
    } else {
        return new Lava(this.pos, this.speed.times(-1))
    }
}

/**
 * 硬币使用它们的update方法来振动。它们忽略与网格的碰撞，因为它们只是在它们自己的方块内部振动
 * 
 * wobble属性会递增以跟踪时间，并用作Math.sin的参数来得出波形上的新位置。然后根据基准位置和
 * 基于此波形的偏移量来计算硬币的当前位置
 */
const wobbleSpeed = 8, wobbleDist = 0.07

Coin.prototype.update = function(time) {
    let wobble = this.wobble + time * wobbleSpeed
    let wobblePos = Math.sin(wobble) * wobbleDist
    return new Coin(this.basePos.plus(new Vec(0, wobblePos)), this.basePos, wobble)
}

/**
 * 玩家运动按每个坐标轴单独处理，因为撞击地板不应该阻止水平运动，
 * 而撞击墙不应该停止下降或跳跃运动
 */

const playerXSpeed = 7
const gravity = 30
const jumpSpeed = 17

Player.prototype.update = function(time, state, keys) {
    let xSpeed = 0
    if(keys.ArrowLeft) xSpeed -= playerXSpeed
    if(keys.ArrowRight) xSpeed += playerXSpeed
    let pos = this.pos
    let movedX = pos.plus(new Vec(xSpeed * time, 0))
    if(!state.level.touches(movedX, this.size, 'wall')) {
        pos = movedX
    }

    let ySpeed = this.speed.y + time * gravity
    let movedY = pos.plus(new Vec(0, ySpeed * time))
    if(!state.level.touches(movedY, this.size, 'wall')) {
        pos = movedY
    } else if(keys.ArrowUp && ySpeed > 0) {
        ySpeed = -jumpSpeed
    } else {
        ySpeed = 0
    }
    return new Player(pos, new Vec(xSpeed, ySpeed))
}

/**
 * 水平运动基于左箭头键和右箭头键的状态计算。
 * 如果没有墙挡住此动作创建的新位置，则使用它。
 * 否则，保留旧位置
 * 
 * 垂直运动以类似的方式工作，但必须模拟跳跃和重力。
 * 首先要加速玩家的垂直速度（ySpeed)以反映重力
 * 
 * 我们再次检查墙壁。如果我们没有撞击任何一面墙，则使用新位置。如果有墙，有两种可能的结果。当我们向下移动
 * （意味着我们将要撞上的东西在我们之下）并且按下向上箭头键时，将速度 设置为相对较大的负值，这会导致玩家
 * 跳跃。如果不是这种情况，那么只需在玩家碰到一些东西后速度设置为零即可
 * 
 * 这个游戏中的重力，跳跃速度和几乎所有其他常数都是通过反复试验来确定的
 */


/**
 * 对于这样的游戏，我们不希望按键在每次按下时都只生效一次。
 * 相反，我们希望只要它们被按住，它们的作用就一直生效
 * 
 * 我们需要设置一个按键处理程序来储存左右和上箭头键的当前状态。我们
 * 还希望为这些键调用preventDefault，以便他们不会最终滚动页面
 * 以下函数在给定键名数组时将返回跟踪这些按键当前位置的对象。
 * 它为keydow和keyup事件注册事件处理程序，并且当事件中的按键代码存在于
 * 它正在跟踪的代码集合中时，更新对象
 */

function trackKeys(keys) {
    let down = Object.create(null)
    function track(event) {
        if(keys.includes(event.key)) {
            down[event.key] = event.type == 'keydown'
            event.preventDefault()
        }
        if(event.target.id) {
            let clickTarget = event.target.id
            if(clickTarget =='leftBtn') {
                down.ArrowLeft = event.type == 'touchstart'
                leftBtn.classList.toggle('active')
                event.preventDefault()
            }
            if(clickTarget =='rightBtn') {
                down.ArrowRight = event.type == 'touchstart'
                rightBtn.classList.toggle('active')
                event.preventDefault()
            }
            if(clickTarget =='jumpBtn') {
                down.ArrowUp = event.type == 'touchstart'
                jumpBtn.classList.toggle('active')
                // 有空试试这样写行吗
                // if(event.type == 'touchstart') {
                    event.preventDefault()
                // }
            }
        }
    }
    // 666 监听了两次，键盘按下时设置 ArrowXXX = true  键盘弹起时设置  ArrowXXX = false
    window.addEventListener('keydown', track)
    window.addEventListener('keyup', track)

    let leftBtn = document.getElementById('leftBtn')
    let rightBtn = document.getElementById('rightBtn')
    let jumpBtn = document.getElementById('jumpBtn')


    leftBtn.addEventListener('touchstart', track)
    leftBtn.addEventListener('touchend', track)
    rightBtn.addEventListener('touchstart', track)
    rightBtn.addEventListener('touchend', track)
    jumpBtn.addEventListener('touchstart', track)
    jumpBtn.addEventListener('touchend', track)
    return down
}

const arrowKeys = trackKeys(['ArrowLeft', 'ArrowRight', 'ArrowUp'])
// 两种事件类型都使用相同的处理函数。它查看事件对象的type属性，以确定是否应将按键状态更新为true('keydown')或false('keyup')

/**
 * 辅助函数 
 * 允许我们简单地调用runAnimation,为它提供一个帧函数，此函数需要将时间差作为参数并绘制一个帧。当帧函数返回
 * false时，动画停止
 * 
 * 我设置了一个100毫秒地最大帧片段。当隐藏浏览器选项卡或隐藏带有我们页面的窗口时，requestAnimationFrame
 * 调用将暂停，直到再次显示选项卡或窗口。在这种情况下，lastTime和time之间地差将是隐藏页面的整个时长。
 * 在一步中就把游戏向前推进那么长时间，看起来很傻，可能会造成奇怪的副作用，例如玩家穿过地板
 * 
 * 此函数还将时间片段转换为秒 ，这是一个比毫秒更加容易想象的单位
 */
function runAnimation(frameFunc) {
    let lastTime = null
    function frame(time) {
        if(lastTime != null) {
            let timeStep = Math.min(time - lastTime, 100) / 1000
            if(frameFunc(timeStep) === false) return
        }
        lastTime = time
        requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
}

