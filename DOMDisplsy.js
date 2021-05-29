/**
 * 使用dom元素来显示关卡
 */

// 辅助函数，提供了一种简洁的方法来创建元素并为其提供一些属性和子节点
function elt(name, attrs, ...children) {
    let dom = document.createElement(name)
    for(let attr of Object.keys(attrs)) {
        dom.setAttribute(attr, attrs[attr])
    }
    for(let child of children) {
        dom.appendChild(child)
    }
    return dom
}

// 通过为显示器提供应附加到其自身的父元素和关卡对象来创建一个显示器
class DOMDisplay {
    constructor(parent, level) {
        this.dom = elt('div', {class: 'game'}, drawGrid(level))
        this.actorLayer = null
        parent.appendChild(this.dom)
    }

    clear() {
        this.dom.remove()
    }
}

/**
 * 关卡的背景网格（从不更改)只被绘制一次，每次使用给定状态更新显示时，都会重新绘制演员。
 * actorLayer属性将用于跟踪保存演员的元素，以便可以轻松删除和替换它们
 */


/**
 * 我们的坐标和大小以网格为单位进行跟踪，其中大小或距离为1表示一个网格块。设置像素大小时，
 * 我们必须将这些坐标按比例放大——游戏中的所有内容按每个方块一个像素来显示将会非常小。
 * scale常数给出了单个单位在屏幕上占用的像素数
 */
const scale = 20

function drawGrid(level) {
    return elt('table', {
        class: 'background',
        style: `width: ${level.width * scale}px`
    }, ...level.rows.map(row => 
        elt('tr', {style: `height: ${scale}px`}, ...row.map(type => elt('td', {class: type})))
    ))
}
// 如上所述，背景绘制为table元素。这很好地对应于关卡的行属性的结构——网格的每一行都变成表格行tr元素。
// 网格中的字符串用作表格单元格td元素的类名称。

/**
 * 通过为每个演员创建一个dom元素并根据演员的属性设置此元素的位置和大小来绘制每个演员。
 * 值必须乘以比例（scale)才能从游戏单位变成像素
 */

function drawActors(actors) {
    return elt('div', {}, ...actors.map(actor => {
        let rect = elt('div', {class: `actor ${actor.type}`})
        rect.style.width = `${actor.size.x * scale}px`
        rect.style.height = `${actor.size.y * scale}px`
        rect.style.left = `${actor.pos.x * scale}px`
        rect.style.top = `${actor.pos.y * scale}px`
        return rect
    }))
}

/**
 * syncState方法用于使显示器展示给定状态。
 * 它首先删除旧的演员图形（如果有的话）
 * 然后重新绘制新位置的演员。
 * 尝试为演员重用dom元素可能很诱人，但为了使其成功，
 * 我们需要大量额外的记录将演员与dom元素相关联，并确保在演员消失时删除元素。
 * 由于游戏中通常只有一小部分演员，因此重新绘制所有演员的成本并不高
 */
DOMDisplay.prototype.syncState = function (state) {
    if(this.actorLayer) this.actorLayer.remove()
    this.actorLayer = drawActors(state.actors)
    this.dom.appendChild(this.actorLayer)
    this.dom.className = `game ${state.status}`
    this.scrollPlayerIntoView(state)
}

/**
 * 通过将关卡的当前状态作为类名添加到包装器，我们可以通过添加仅在玩家具有 给定类的祖先元素时才生效的
 * css规则来使玩家在赢得或输掉游戏时演员的样式略有不同
 */

 /* 不能保证关卡总会恰好铺满视口（viewport）——我们用来绘制游戏的元素。
 这就是需要scrollPlayerIntoView调用的原因。
 它确保如果关卡延伸到视口外，我们会滚动此视口以确保玩家位于其中心位置。 */

 /**
  * 在scrollPlayerIntoView方法中，我们找出玩家的位置并更新其包装器元素的
  * 滚动坐标，我们可以通过操作元素的scrollLeft和scrollTop属性，
  * 当玩家接近视口边界时修改滚动坐标
  */
 DOMDisplay.prototype.scrollPlayerIntoView = function(state) {
     let width = this.dom.clientWidth
     let height = this.dom.clientHeight
     let margin = width / 3
     
     // The viewport
     let left = this.dom.scrollLeft, right = left + width
     let top = this.dom.scrollTop, bottom = top + height

     let player = state.player
     let center = player.pos.plus(player.size.times(0.5)).times(scale)

     if(center.x < left + margin) {
         this.dom.scrollLeft = center.x -margin
     } else if(center.x > right - margin) {
         this.dom.scrollLeft = center.x + margin -width
     }
     if(center.y < top + margin) {
         this.dom.scrollTop = center.y -margin
     } else if(center.y > bottom -margin) {
         this.dom.scrollTop = center.y + margin -height
     }
 }
 // 找出玩家中心位置的代码展示了，我们如何使用vec类型来写出相对可读的计算代码。
 /**
  * 为了找出玩家的中心位置，我们需要将左上角位置坐标加上其尺寸的一半。
  * 计算结果就是关卡坐标的中心位置。但是我们需要将结果向量乘以显示比例，
  * 以将坐标转换成像素级坐标
  * 
  * 接下来我们对玩家的坐标进行一系列检测，确保其位置不会超出合法范围。
  */