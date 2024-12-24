let global_id = 0;
const svg = document.getElementById('main_svg')
const sel_svg = document.getElementById('selector_svg')
let line_connectors_map = new Map();
let aligning_data = new Map()
let line_mode = false;
let selected_line_connector = null;

let shapes_map = new Map();

class Shape {
    constructor(svg='main_svg', id=null, from_global=true, save_in_shapes_map = true) {
        this.svg = document.getElementById(svg);
        this.shape =  null;

        this.set_id(id, from_global, save_in_shapes_map)
    }

    set_id(id, from_global, save_in_maps) {

        if (from_global) {
            id = global_id;
            global_id++;
        }

        if (id != null ) {
            this.id = id;
        }

        if (save_in_maps && id != null ) {
            shapes_map.set(this.id, this);
        }
 
    }
    append_to_svg(svg=this.svg, shape=this.shape) {
        svg.append(shape);
        this.shape.setAttribute('id', this.id); 
    }

    remove() {
        this.svg.removeChild(this.shape)
    }

    hide(shape=this.shape) {
        shape.setAttribute('display', 'none')
    }

    reveal(shape=this.shape) {
        shape.removeAttribute('display')
    }
    
    set_stroke_color(color){
        this.shape.setAttribute('stroke', color); 
    }
    
    set_stroke_width(size)  {
        this.shape.setAttribute('stroke-width', size); // 2!
    }

    update() {
        throw new Error('This method is for updating the position when the x,y of the element is changed.\
            The pattern of update must be defined in the subclasses.');
    }
} 

class Closed_Shape extends Shape {
    constructor(x,y,width,height,shape,align=true) {
        super();
        this.connections = [];
        this.line_connectors = [];
        this.selector = null;
        
        this.shape = document.createElementNS('http://www.w3.org/2000/svg', shape);
        super.append_to_svg()

        this.width = width;
        this.height = height;
        this.set_stroke_width(1.2);
        
   
        this.update(x,y,this.width,this.height)
 

        this.align = align
        if (this.align) {
            update_aligning(this.id, [this.a[0], this.a[1], this.c[0], this.c[1]])
        }
        this.shape.setAttribute('class', 'closed_shape');
        this.shape.addEventListener('mousedown', (e) => this.startDrag(e));
        window.addEventListener('mousemove', (e) => this.drag(e));
        window.addEventListener('mouseup', () => this.endDrag());
        this.shape.addEventListener("dblclick", () => this.updateLiveTextContent());
    }

    shape_clicked() {
        if (selector[0] != this.id && !line_mode) {
            selector[0] = this.id;
            selector[1].update(this.x, this.y, this.width, this.height, this.id);

            selector[1].reveal();
            this.selector = selector[1];
        }
    }

    update(x,y, width=this.width, height=this.height) {
        
        this.x = x;
        this.y = y;

        this.width = width;
        this.height = height;

        this.a = [x,y]
        this.b = [x+this.width, y]
        this.c = [x+this.width, y+this.height]
        this.d = [x, y+this.height]

        this.cx = (x + this.b[0]) / 2
        this.cy = (y + this.c[1]) / 2

        this.ab = [this.cx, y]
        this.bc = [this.b[0], this.cy]
        this.cd = [this.cx, this.c[1]]
        this.da = [x, this.cy]

        //implemented in subclasses
        this.update_interest_points()

        this.update_shape()
        if (this.text) {
            this.update_text_position()
        }

        

        if (this.align) {
            this.update_connections()
            update_aligning(this.id, [this.a[0], this.a[1], this.c[0], this.c[1]])
        }


    }

    update_shape() {
        throw new Error('Must be implemented in the subclasses, with its specific point distribution pattern');
    }
 
    add_connection(line, key, point) {
        this.connections.push([ line, key, point ]);
    }

    remove_connection(line){
        this.connections = this.connections.filter(connection => connection[0] !== line )
    }

    
    update_connections() { // updating shape, not status
        
        for (const [ line, key, point ] of this.connections) {
            {
                line.update_line_one_sided(this.interest_points[point], key);
            }
        }
    }

    draw_text(text = 'Test text', font_size = 16) {
        let min_cords = this.getMinCoordinates()
        this.text = new Inner_Text(text, min_cords[0], min_cords[1], this.width, this.height, font_size)

    }
    
    //only work for rectangles
    getMinCoordinates() {
        // Extract all x and y values from the points
        const xValues = [this.a[0], this.b[0], this.c[0], this.d[0]];
        const yValues = [this.a[1], this.b[1], this.c[1], this.d[1]];
    
        // Find the minimum x and y values
        const minX = Math.min(...xValues);
        const minY = Math.min(...yValues);
    
        // Return the minimum x and y as a pair
        return [minX, minY];
      }
    

    update_text_position() {
        let min_cords = this.getMinCoordinates()
        this.text.update_text_container(min_cords[0], min_cords[1], this.width, this.height)
    }

    update_text(text) {
        this.text.textContent = text
    }

    set_fill(color) {
        this.shape.setAttribute('fill', color);
    }

    update_selector() {

        if (this.selector != null) {
            this.selector.update(this.x,this.y,this.width,this.height, this.id)
        }
    }

    startDrag(event) {
        if (!line_mode) {
            this.isDragging = true;
        }

        this.startX = event.clientX;
        this.startY = event.clientY;

        this.originX = this.x || 0
        this.originY = this.y || 0


        this.shape_clicked()

    }

    drag(event) {
        if (!this.isDragging) return;

        let deltaX = event.clientX - this.startX;
        let deltaY = event.clientY - this.startY;

        let newX = this.originX + deltaX;
        let newY = this.originY + deltaY;
        let c_point = [newX+this.width, newY+this.height]

        let aligning_points = find_aligning_points(this.id, [newX, newY, c_point[0], c_point[1]])

        if (aligning_points[0] != null) {
            newX = aligning_points[0]
        }
        if (aligning_points[1] != null) {
            newY = aligning_points[1]
        }


        this.update(newX, newY);
        this.update_selector();
        this.update_connections(); 
    }

    endDrag() {
        this.isDragging = false;
    }

    updateLiveTextContent() {
        this.text.enableEditing();
    }

    update_line_connectors() {

        for (let i = 0; i < this.interest_points.length; i++) {
            this.line_connectors[i].update(this.interest_points[i][0], this.interest_points[i][1]) 
        }
    }

    remove() {
        super.remove();
        this.text.remove();
        for (let connection of this.connections) {
            connection[0].remove();
        }
        this.selector.hide();
        shapes_map.delete(this.id);
        aligning_data.delete(this.id);
    }
}

class Line_Connector extends Shape {
    constructor(x,y,r=6) {
        super('selector_svg', null, false, false)

        this.radius = r;
        
        this.shape = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        this.shape.setAttribute('opacity', 0.6);
        this.shape.setAttribute('fill', '#5c5c5c');

        this.inner_circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        this.inner_circle.setAttribute('opacity', 1);
        this.inner_circle.setAttribute('fill', '#cecece');
        this.inner_circle.setAttribute('class', 'love');

        this.update(x,y,r);


        this.append_to_svg(sel_svg, this.shape);
        this.append_to_svg(sel_svg, this.inner_circle);


        this.hide(this.inner_circle)
        this.hide(this.shape) 

        this.inner_circle.setAttribute('pointer-events', 'none');

        this.shape.addEventListener('mouseenter', () => this.moused_over()) 
        this.shape.addEventListener('mouseleave', () => this.moused_out()) 

    }

    moused_over() {
        selected_line_connector = this;
        this.grow = true;
        const maxRadius = 9;
        const speed = 0.5;

        const animateCircle = () => {
            if (this.radius < maxRadius && this.grow == true) {
                this.radius += speed;
                this.shape.setAttribute("r", this.radius);
            } else {
                clearInterval(animation); // Stop the interval when the maximum radius is reached
            }
        };

        const animation = setInterval(animateCircle, 20); // Start the interval
    }

    moused_out() {

        selected_line_connector = null;
        this.grow = false;
        const minRadius = 6;
        const speed = 0.5;

        const animateCircle = () => {
            if (this.radius > minRadius) {
                this.radius -= speed;
                this.shape.setAttribute("r", this.radius);
            } else {
                clearInterval(animation);
            }
        };

        const animation = setInterval(animateCircle, 20);
    }

    update(x,y,r=this.r) {

        this.cx = x;
        this.cy = y;
        this.r = r;
        this.update_shape()
    }

    update_shape() {
        this.shape.setAttribute('cx', this.cx);
        this.shape.setAttribute('cy', this.cy);
        this.shape.setAttribute('r', this.r);

        this.inner_circle.setAttribute('cx', this.cx);
        this.inner_circle.setAttribute('cy', this.cy);
        this.inner_circle.setAttribute('r', this.r/5);
    }

    hide() {
        super.hide()
        this.inner_circle.setAttribute('display', 'none')
    }
    reveal() {
        super.reveal()
        this.inner_circle.removeAttribute('display')
    }
}

class Relationship extends Closed_Shape {
    // RHOMBOID
    // Intended to draw rhomboids with proportions 7/4
    constructor(x, y, width, height) {
        super(x,y,width,height,'polygon')
        this.update_shape()
        this.add_line_connectors()
        this.set_fill('#ffde59')

    }

    update_interest_points() {
        this.interest_points = [
            this.ab, this.bc, this.cd, this.da,
            [(this.ab[0] + this.da[0]) / 2, (this.ab[1] + this.da[1]) / 2],
            [(this.ab[0] + this.bc[0]) / 2, (this.ab[1] + this.bc[1]) / 2],
            [(this.cd[0] + this.bc[0]) / 2, (this.cd[1] + this.bc[1]) / 2],
            [(this.cd[0] + this.da[0]) / 2, (this.cd[1] + this.da[1]) / 2],
        ];
    }

    update_shape() {
        this.pointsData = 
            this.ab.join(',') + " " + 
            this.bc.join(',') + " " + 
            this.cd.join(',') + " " + 
            this.da.join(',');
        this.shape.setAttribute('points', this.pointsData);
    }

    add_line_connectors() {

        // Calculate middle points for line segments
        let segments_middle_points = [
            [(this.ab[0] + this.da[0]) / 2, (this.ab[1] + this.da[1]) / 2],
            [(this.ab[0] + this.bc[0]) / 2, (this.ab[1] + this.bc[1]) / 2],
            [(this.cd[0] + this.bc[0]) / 2, (this.cd[1] + this.bc[1]) / 2],
            [(this.cd[0] + this.da[0]) / 2, (this.cd[1] + this.da[1]) / 2],
        ];

        let middle_points = [this.ab, this.bc, this.cd, this.da];

        this.interest_points = middle_points.concat(segments_middle_points);

        for (let point_index in this.interest_points) {
            let point = this.interest_points[point_index];
            let new_line_connector = new Line_Connector(point[0], point[1]);
            this.line_connectors.push(new_line_connector);
            line_connectors_map.set(new_line_connector, [this.id, point_index] );
        }
        
    }
    
}

class Entity extends Closed_Shape {
    // RECTANGLE
    
    constructor(x, y, width, height, align=true) {
        super(x,y,width,height,'polygon', align)
        this.update_shape()
        if (align){
            this.add_line_connectors()
        }
        this.set_fill('#c9e265')
    }

    update_interest_points() {
        this.interest_points = [this.a, this.ab, this.b, this.bc, this.c, this.cd, this.d, this.da];
    }

    update_shape() {
        this.pointsData = 
            this.a.join(',') + " " + 
            this.b.join(',') + " " + 
            this.c.join(',') + " " + 
            this.d.join(',');
        this.shape.setAttribute('points', this.pointsData);
    }

    add_line_connectors() {

        this.interest_points = [this.a, this.ab, this.b, this.bc, this.c, this.cd, this.d, this.da];


        for (let point_index in this.interest_points) {
            let point = this.interest_points[point_index];
            let new_line_connector = new Line_Connector(point[0], point[1]);
            this.line_connectors.push(new_line_connector);
            line_connectors_map.set(new_line_connector, [this.id, point_index] );
        }
    

        
    }
}
   
class Attribute extends Closed_Shape {
    
    // ELLIPSE
    constructor(x, y, width, height) {
        super(x,y,width,height,'ellipse')
        this.update_shape()
        this.add_line_connectors()
        this.set_fill('#ffbd59')
        
    }

    update_interest_points() {
        this.interest_points = this.calculateEllipsePoints(this.cx, this.cy, this.width/2, this.height/2);
    }


    update_shape() {
        this.rx = Math.abs(this.cx - this.x);
        this.ry = Math.abs(this.cy - this.y);
        
        this.shape.setAttribute('cx', this.cx)
        this.shape.setAttribute('cy', this.cy)
        this.shape.setAttribute('rx', this.rx)
        this.shape.setAttribute('ry', this.ry)
    }
    
    
    calculateEllipsePoints(h, k, a, b) {
        const points = [];
        const angles = [0, 45, 90, 135, 180, 225, 270, 315]; 

        for (let angle of angles) {
            let radians = angle * (Math.PI / 180); 
            let x = h + a * Math.cos(radians); 
            let y = k + b * Math.sin(radians); 
            points.push([ x, y ]);
        }

        return points;
    }

    add_line_connectors() {
        this.interest_points = this.calculateEllipsePoints(this.cx, this.cy, this.width/2, this.height/2);

        for (let point_index in this.interest_points) {
            let point = this.interest_points[point_index]
            let new_line_connector = new Line_Connector(point[0], point[1]);
            this.line_connectors.push(new_line_connector);
            line_connectors_map.set(new_line_connector, [this.id, point_index] );
        }
    }
    
}

class Selector extends Shape {

    constructor(x=1, y=1, width=1, height=1) {
        super('selector_svg', 'selector', false, false)
        this.guest_id = null;

        this.shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        this.width = width;
        this.height = height;

        this.update(x,y,this.width,this.height);

        this.append_to_svg();
        this.add_vertices();
        
        this.set_stroke_color('#000000'); // or b7c9e2
        this.shape.setAttribute('fill', 'none');
        this.shape.setAttribute('stroke-dasharray', '4 4')
        this.set_stroke_width(1.2);


        this.hide();

    }

    add_vertices() {

        this.vertices = {
            A: new Resizer(this.a[0], this.a[1], 5, 5, 'resizer_a'), // Top-left
            B: new Resizer(this.b[0], this.b[1], 5, 5, 'resizer_b'), // Top-right
            C: new Resizer(this.c[0], this.c[1], 5, 5, 'resizer_c'), // Bottom-right
            D: new Resizer(this.d[0], this.d[1], 5, 5, 'resizer_d')  // Bottom-left
          };

        for (let vertexKey in this.vertices) {
            this.vertices[vertexKey].setSeletor(this);
        }

        this.append_to_svg
    }

    update(x,y, width, height, guest_id) {
        this.x = x;
        this.y = y;
        this.guest_id = guest_id;
        this.width = width;
        this.height = height;

        this.a = [x,y];
        this.b = [x+this.width, y];
        this.c = [x+this.width, y+this.height];
        this.d = [x, y+this.height];

        this.cx = (x + this.b[0]) / 2;
        this.cy = (y + this.c[1]) / 2;

        this.ab = [this.cx, y];
        this.bc = [this.b[0], this.cy];
        this.cd = [this.cx, this.c[1]];
        this.da = [x, this.cy];

        this.update_shape()
        if (this.vertices != null) {
            this.update_resizers();
        }

        this.guest = shapes_map.get(Number(this.guest_id));
    }

    reshaping_update() {
        this.x = this.a[0];
        this.y = this.a[1];

        this.width = this.b[0] - this.a[0];
        this.height = this.d[1] - this.a[1];

        this.cx = (this.x + this.b[0]) / 2;
        this.cy = (this.y + this.c[1]) / 2;

        this.ab = [this.cx, this.y];
        this.bc = [this.b[0], this.cy];
        this.cd = [this.cx, this.c[1]];
        this.da = [this.x, this.cy];

        this.update_shape()
        if (this.vertices != null) {
            this.update_resizers();
        }
        
        this.guest.update(this.x, this.y, this.width, this.height);
    }
    
    update_shape() {
        this.pointsData = 
            this.a.join(',') + " " + 
            this.b.join(',') + " " + 
            this.c.join(',') + " " + 
            this.d.join(',');
        this.shape.setAttribute('points', this.pointsData);
    }


    update_resizers() {
        let cords = [this.a, this.b, this.c, this.d];
        let cords_idx = 0;
        for (let key in this.vertices) {
            this.vertices[key].update(cords[cords_idx][0], cords[cords_idx][1]);
            cords_idx++;
        }
    }

    hide() {
        super.hide()
        for (let key in this.vertices) {
            this.vertices[key].hide()
        }
    }

    reveal() {
        super.reveal()
        for (let key in this.vertices) {
            this.vertices[key].reveal()
        }
    }

    moveVertex(vertex, newX, newY) {
        switch (vertex) {
            case 'A': // Top-left
                this.a = [newX, newY];
                this.b[1] = newY; // Top-right aligns vertically
                this.d[0] = newX; // Bottom-left aligns horizontally
                break;
    
            case 'B': // Top-right
                this.b = [newX, newY];
                this.a[1] = newY; 
                this.c[0] = newX; 
                break;
    
            case 'C': // Bottom-right
                this.c = [newX, newY];
                this.b[0] = newX;
                this.d[1] = newY;
                break;
    
            case 'D': // Bottom-left
                this.d = [newX, newY];
                this.a[0] = newX; 
                this.c[1] = newY; 
                break;
    
            default:
                console.error("Invalid vertex specified");
        }
    
        this.reshaping_update();
    }

    add_line_connectors() {
        this.interest_points = [this.a, this.ab, this.b, this.bc, this.c, this.cd, this.d, this.da];
        if (this.shape.tagName == 'polygon' && this.shape.align == true) {

            for (let point_index in this.interest_points) {
                let point = this.interest_points[point_index]
                let new_line_connector = new Line_Connector(point[0], point[1]);
                line_connectors_map.set(new_line_connector, [this.id, point_index] );
            }
        }
    }
}

class Resizer extends Shape {
    // ELLIPSE
    constructor(x, y, width, height, id) {
        super('selector_svg', id, false, false)

        this.shape = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
        this.append_to_svg();
        this.shape.setAttribute('fill', 'white');
        this.set_stroke_color('black');


        this.x = x;
        this.y = y;
        this.height = height;
        this.width = width;
        this.cx = (x + this.width + x) / 2;
        this.cy = (y + this.height+ y) / 2;
        this.rx = this.width / 2;
        this.ry = this.height / 2;
        this.update_shape();

        
        this.isDragging  = false;
        this.shape.addEventListener('mousedown', (e) => this.startDrag(e));
        window.addEventListener('mousemove', (e) => this.drag(e));
        window.addEventListener('mouseup', () => this.endDrag());
        }

    setSeletor(selector) {
        this.selector = selector;
        this.vertices = selector.vertices;
    }

    update(x, y) {
        this.x = x
        this.y = y
        this.cx = x; // Update center x
        this.cy = y; // Update center y
        this.update_shape();
    }

    update_shape() {
        this.shape.setAttribute('cx', this.cx);
        this.shape.setAttribute('cy', this.cy);
        this.shape.setAttribute('rx', this.rx);
        this.shape.setAttribute('ry', this.ry);
        
    }


    startDrag(e) {
        this.isDragging = true;

        this.startX = e.clientX;
        this.startY = e.clientY;

        this.originX = this.x || 0
        this.originY = this.y || 0
 
        e.preventDefault();
    }

    drag(e) {
        if (!this.isDragging) return;

        let deltaX = e.clientX - this.startX;
        let deltaY = e.clientY - this.startY;

        let newX = this.originX + deltaX;
        let newY = this.originY + deltaY;

        this.update(newX, newY);

        for (let vertexKey in this.vertices) {
            if (this.vertices[vertexKey] === this) {
                this.selector.moveVertex(vertexKey, newX, newY);
                break;
            }
        }


    }

    endDrag() {
        this.isDragging = false;
    }
}

class Line_Resizer extends Shape {
    // ELLIPSE
    constructor(side, size=5, ) {
        super('selector_svg', null, false, false)

        this.side = side;
        this.line = null;

        this.isDragging  = false;
        this.shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        this.shape.setAttribute('fill', 'lightblue');
        this.set_stroke_color('black');

        this.size = size;

        this.shape.addEventListener('mousedown', (e) => this.startDrag(e));
        window.addEventListener('mousemove', (e) => this.drag(e));
        window.addEventListener('mouseup', () => this.endDrag());

        this.append_to_svg();
        }

    setSeletor(selector) {
        this.selector = selector;
        this.vertices = selector.vertices;
    }

    update(cx, cy, size=this.size) {

        this.cx = cx
        this.cy = cy
        this.x = this.cx - size / 2;
        this.y = this.cy - size / 2; 
        this.size = size;

        this.update_shape();
    }

    update_shape() {
        this.shape.setAttribute('x', this.x);
        this.shape.setAttribute('y', this.y);
        this.shape.setAttribute('width', this.size);
        this.shape.setAttribute('height', this.size);
        
    }

    startDrag(e) {
        this.isDragging = true;

        this.startX = e.clientX;
        this.startY = e.clientY;

        this.originX = this.x || 0
        this.originY = this.y || 0

        this.line = shapes_map.get(Number(line_selector[0]))
        line_mode_togglign() 
        highlighted_line = this.line;
        highlighted_side = this.side;
        
        draw_lines = false;
        e.preventDefault();
    }


    drag(e) {
        if (!this.isDragging) return;

        let deltaX = e.clientX - this.startX;
        let deltaY = e.clientY - this.startY;

        let newX = this.originX + deltaX;
        let newY = this.originY + deltaY;

        this.update(newX, newY);

        this.line.update_line_one_sided([this.cx, this.cy], this.side);
        

    }

    endDrag() {
        if (!this.isDragging) return;
        draw_lines = true;
        highlighted_line = null;
        highlighted_side = null;
        this.isDragging = false;

        line_mode_togglign()
    }
}

class Line extends Shape {
    constructor(point1, point2=null, id_1=null, id_2=null, color='black', size='1.7') {

        super('main_svg', null, true, true)
        this.shape = document.createElementNS('http://www.w3.org/2000/svg', 'line')
        this.line_selectors = []
        this.shape.classList.add('line')

        this.connected_ids = [id_1, id_2]
        if (point2 != null) {
            this.update_line(point1, point2) 
        } else {

        }

        this.set_stroke_color(color)
        this.set_stroke_width(size)

    }

    update_side(side, polygon_id, point) {
        if (side == 'a') {
            shapes_map.get(this.connected_ids[0]).remove_connection(this);
            this.connected_ids[0] = polygon_id;
            shapes_map.get(this.connected_ids[0]).add_connection(this, side, point);
            this.update_line_one_sided(shapes_map.get(this.connected_ids[0][point], side))
        }
        if (side == 'b') {
            shapes_map.get(this.connected_ids[1]).remove_connection(this);
            this.connected_ids[1] = polygon_id;
            shapes_map.get(this.connected_ids[1]).add_connection(this, side, point);
            this.update_line_one_sided(shapes_map.get(this.connected_ids[0][point], side))
        }
    } 

    shape_clicked(e) {
        if (line_selector[0] != this.id && !line_mode) {
            line_selector[0] = this.id;
            line_selector[1][0].update(this.x1, this.y1);
            line_selector[1][1].update(this.x2, this.y2);
            line_selector[1][0].reveal();
            line_selector[1][1].reveal();
   
        }
    }

    update_selectors() {
        this.selectors = [ line_selector[1][0], line_selector[1][1] ]
        line_selector[0] = this.id;
    }

    // still not implemented self-connection,
    set_connection_ids(id1, id2) {
        this.connected_ids[id1, id2]
    }

    update_line(point1, point2) {
        this.x1 = point1[0]
        this.x2 = point2[0]
        this.y1 = point1[1]
        this.y2 = point2[1]

        this.shape.setAttribute('x1', this.x1)
        this.shape.setAttribute('x2', this.x2)
        this.shape.setAttribute('y1', this.y1)
        this.shape.setAttribute('y2', this.y2)
    }

    update_point_2(x,y) {

        this.x2 = x;
        this.y2 = y;
        this.shape.setAttribute('x2', this.x2)
        this.shape.setAttribute('y2', this.y2)
    }

    update_line_one_sided(point, key) {


        if (key == 'a') {

            this.x1 = point[0]
            this.y1 = point[1]
            this.shape.setAttribute('x1', this.x1)
            this.shape.setAttribute('y1', this.y1)

        } else {
            this.x2 = point[0]
            this.y2 = point[1]
            this.shape.setAttribute('x2', this.x2)
            this.shape.setAttribute('y2', this.y2)
        }
    }

    remove() {
        super.remove();
        
        for (let id of this.connected_ids) {
            if (id != null) {
                let participant_object = shapes_map.get(id);
                participant_object.connections = participant_object.connections.filter(e => e[0] !== this)
            }
        }
     }
 }

class Outer_Text extends Entity {
    constructor(x,y,width,height) {
        
        super(x,y,width,height,false)
        this.set_stroke_color('transparent');
        this.set_fill('transparent')
        this.append_to_svg();
    }
    
}

class Text {
    constructor(content, x, y, width, height, font_size) {
        this.svg = document.getElementById('main_svg');

        this.text = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
        this.text.classList.add('class', 'text')
        this.text.textContent = content;
        this.text.style.fontSize = font_size + 'px';
        this.text.setAttribute("contenteditable", "true");
        this.text.addEventListener("dblclick", () => this.enableEditing());
        this.text.addEventListener("blur", () => this.disableEditing());
        
    } 
    
    enableEditing() {
        this.text.setAttribute("contenteditable", "true");
        this.text.style.pointerEvents = "auto";
        this.text.focus();
    }

    disableEditing() {
        this.text.setAttribute("contenteditable", "false");
        this.text.style.pointerEvents = "none";
    }

    remove() {
        this.text.remove()
    }

}

class Inner_Text extends Text {
    constructor(content, x, y, width, height, font_size) {
        super(content, x, y, width, height, font_size)

        this.svg = document.getElementById('main_svg');
        // Creating the container of the text as a foreign object element
        this.textContainer = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
        this.textContainer.setAttribute('class', 'foreignobj_container')
        this.update_text_container(x, y, width, height)
        this.svg.appendChild(this.textContainer);

        // Now initializing the text element
        this.centering_div = document.createElement("div");
        this.centering_div.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
        this.centering_div.classList.add("text_container");
        this.textContainer.append(this.centering_div)

        this.centering_div.append(this.text)
        
    }

    update_text_container(x,y,width,height) {
        this.textContainer.setAttribute('x', x);
        this.textContainer.setAttribute('y', y);
        this.textContainer.setAttribute('width', Math.abs(width));
        this.textContainer.setAttribute('height', Math.abs(height));
    }

    remove() {
        super.remove()
        this.textContainer.remove()
        this.centering_div.remove()
    }
}


function connect(polygon1, point1, polygon2, point2) {

    let new_line = new Line(polygon1.interest_points[point1], polygon2.interest_points[point2], polygon1.id, polygon2.id)


    polygon1.add_connection(new_line, 'a', point1);
    polygon2.add_connection(new_line, 'b', point2);
    
    new_line.append_to_svg()
}

function addElement(type, text) {
    let x = Math.random() * 500;
    let y = Math.random() * 300; 
    let width = 175;
    let height = 100;

    let newElement;
    if (type === 'Entity') {
        newElement = new Entity(x, y, width, height);
        // newElement.set_fill('#c9e265'); // used to be lightblue
        newElement.set_stroke_color('black');
    } else if (type === 'Relationship') {
        newElement = new Relationship(x, y, width, height);

        newElement.set_stroke_color('black');
    } else if (type === 'Attribute') {
        newElement = new Attribute(x, y, width/1.8, height/2);

        newElement.set_stroke_color('black');
    } else if (type === 'Text') {
        newElement = new Outer_Text(x,y,width/3,height/3);

    } else {
        console.warn('Unknown element type:', type);
        return;
    }

    newElement.append_to_svg();
    newElement.draw_text(text || type, 16);
}

// Add event listeners for toolbar buttons
document.getElementById('addEntity').addEventListener('click', () => {
    addElement('Entity', 'New Entity');
});

document.getElementById('addAttribute').addEventListener('click', () => {
    addElement('Attribute', 'New Attribute');
});

document.getElementById('addText').addEventListener('click', () => {
    addElement('Text', 'New Text');
});

document.getElementById('addRelationship').addEventListener('click', () => {
    addElement('Relationship', 'New Relationship');
});


document.getElementById('line_mode').addEventListener('click', () => {

    line_mode_togglign() 

});


function line_mode_togglign() {
    function toggleTextInteractivity(enable) {
        const textElements = document.querySelectorAll('.text');
        textElements.forEach(textElement => {
            textElement.style.pointerEvents = enable ? 'auto' : 'none';
        });
    }

    line_mode = !line_mode;
    if (line_mode == true) {

        for (let line_connector of line_connectors_map.keys()) {
            toggleTextInteractivity(false); 
            line_connector.reveal();   
            for (let shape of shapes_map.values()) {
                if (typeof shape.update_line_connectors === 'function' && shape.align == true) {
                    shape.update_line_connectors();
                }
            }

            selector[0] = 'none'; // Remove the current selector reference, and hide it,
            selector[1].guest_id = null;
            selector[1].hide();
        }
    } else {
        for (let line_connector of line_connectors_map.keys()) {
            toggleTextInteractivity(true);
            line_connector.hide();    
        }
    }
}
const developer_entity = new Entity(263, 150, 175, 100) 
developer_entity.set_stroke_color('black')
developer_entity.draw_text('Developer', 16)


const develop_relationship = new Relationship(663, 150, 175, 100);
develop_relationship.set_stroke_color('black')
develop_relationship.draw_text('Develops', 16)


const project_entity = new Entity(1063, 150, 175, 100)
project_entity.set_stroke_color('black')
project_entity.draw_text('Project', 16)


const cardinality = new Outer_Text(726, 110, 50, 50)
cardinality.draw_text('1:N', 16)

const left_distribution = new Outer_Text(440, 150, 50, 50)
left_distribution.draw_text('1:N', 16)

const right_distribution = new Outer_Text(1010, 150, 50, 50)
right_distribution.draw_text('0:N', 16)





connect(developer_entity, '3', develop_relationship, '3');
connect(develop_relationship, '1', project_entity, '7');

let selector = ['none', new Selector()];
let line_selector = ['none', [new Line_Resizer('a'), new Line_Resizer('b')]]
let selected_svg_object = null;

document.addEventListener('keydown', (event) => {

    if (selected_svg_object != null) {

        if (event.key == 'Delete') {
            selected_svg_object.remove()
        }}
    }

)

let isDrawing = false;
let currentLine = null;
let highlighted_line = null;
let highlighted_side = null;
let first_connection_point = null; //the possible first point where the line connection starts
let draw_lines = true;

document.addEventListener('click', event => {

    let clicked_element = event.target;
    selected_svg_object = shapes_map.get(Number(clicked_element.id))

    if (selected_svg_object != null && !line_mode) {
        selected_svg_object.shape_clicked()
        if (!clicked_element instanceof Line) {
            selected_svg_object.update_selector(clicked_element.id)
        } 
    }  else {
        selector[0] = 'none'; // Remove the current selector reference, and hide it,
        selector[1].guest_id = null;
        selector[1].hide();
        line_selector[0] = 'none';

        line_selector[1][0].hide();
        line_selector[1][1].hide();
    }
});




mother_svg = document.getElementById('mother_svg')
    
mother_svg.addEventListener('mousedown', (e) => {

    if (!line_mode || svg.contains(event.target)) return
    
        
    
    isDrawing = true;

    if (selected_line_connector != null) {
        first_connection_point = selected_line_connector;
    }

    origin_xy = [e.offsetX, e.offsetY]
    
    if (highlighted_line == null) {
        currentLine = new Line(origin_xy, origin_xy);
        currentLine.set_stroke_width('1.2');
        currentLine.set_stroke_color('black'); 
        svg.insertBefore(currentLine.shape, svg.firstChild || null);      
    } else {
        currentLine = highlighted_line;

    }


});

mother_svg.addEventListener('mousemove', (e) => {
    if (!line_mode || svg.contains(event.target) || !currentLine) return
    if (highlighted_line == null) {
        currentLine.update_point_2(e.offsetX, e.offsetY);
    }
});


mother_svg.addEventListener('mouseup', () => {
    
    if (selected_line_connector != null && svg.contains(event.target)) {
        
        if (highlighted_line == null) {

            let last_polygon_data = line_connectors_map.get(selected_line_connector);
            let first_polygon_data = line_connectors_map.get(first_connection_point);

            if (last_polygon_data != null && first_polygon_data != null) {
                    connect(shapes_map.get(first_polygon_data[0]), first_polygon_data[1], shapes_map.get(last_polygon_data[0]), last_polygon_data[1])
                    currentLine.remove()
                }
            } 
    } 
    if (highlighted_side != null) {

        let last_polygon_data = line_connectors_map.get(selected_line_connector);

        currentLine.update_side(highlighted_side, last_polygon_data[0], last_polygon_data[1])
    }

    first_connection_point = null;
    isDrawing = false;
    currentLine = null; 
});

mother_svg.addEventListener('mouseleave', () => {
    isDrawing = false;
    currentLine = null;
});

    
function find_aligning_points(current_shape, points) {
    let prev_x_dif = null
    let prev_y_dif = null
            
    let horizontal_align = null
    let vertical_align = null
    let checking_cord = null

    for (let key of aligning_data.keys()) {
        if (key !== current_shape) {
            for (let i=0; i < 4; i++) {
          

                let checking_cord = aligning_data.get(key);

                let difference = Math.abs(checking_cord[i] - points[i])
      
     
                if (difference < 10)  {
                    if ((i % 2 == 0)) {

                        if (horizontal_align != null) {
              
                            if (Math.max(difference, prev_x_dif) < difference) {
                                horizontal_align = checking_cord[i]
                                prev_x_dif = difference;
                                
                            }
                        }
                        else {
                            horizontal_align = checking_cord[i]
                            prev_x_dif = difference;
                        }
                    } 
                    else {
                        if (vertical_align != null) {
                
                            if (Math.max(difference, prev_y_dif) < difference) {
                                horizontal_align = checking_cord[i]
                                prev_x_dif = difference;
                            }

                        }
                        else {
                            vertical_align = checking_cord[i]
                            prev_y_dif = difference;
                        }
                    }
                } 
            }     
        }
    }
    return [horizontal_align, vertical_align]
}

function update_aligning(shape_id, points) {
    aligning_data.set(shape_id, points)
}

function exportDiagram(format = 'jpeg', fileName = 'diagram', svg_string=get_svg()) {
    format = format.toLowerCase();

    const svgBlob = new Blob([svg_string], { type: 'image/svg+xml' });

    if (format === 'svg') {
        const url = URL.createObjectURL(svgBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileName}.svg`;
        link.click();
        URL.revokeObjectURL(url);
        return;
    }

    const img = new Image();
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {

        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;

        const context = canvas.getContext('2d');
        context.fillStyle = 'white';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(img, 0, 0);

        canvas.toBlob(
            (blob) => {
                const imageURL = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = imageURL;
                link.download = `${fileName}.${format}`;
                link.click();
                URL.revokeObjectURL(imageURL);
            },
            `image/${format}`,
            1.0 
        );

        URL.revokeObjectURL(url);
    };

    img.onerror = () => {
        console.error('Failed to load SVG string as an image.');
        URL.revokeObjectURL(url);
    };

    img.src = url;
}

document.getElementById('savePng').addEventListener('click', () => {
    exportDiagram('png')
});

document.getElementById('saveJpeg').addEventListener('click', () => {
    exportDiagram('jpeg')
});

document.getElementById('saveSvg').addEventListener('click', () => {
    exportDiagram('svg')
});


function get_svg() {
    function get_text_data(raw_svg) {
        const regex = /<foreignObject[^>]*x="([^"]+)"[^>]*y="([^"]+)"[^>]*width="([^"]+)"[^>]*height="([^"]+)"[^>]*>[\s\S]*?<div[^>]*style="[^"]*font-size:\s*([^;]+)px;?[^"]*"[^>]*contenteditable="(?:true|false)"[^>]*>(.*?)<\/div>[\s\S]*?<\/foreignObject>/g;

        const text_data = [];
        let match;

        while ((match = regex.exec(raw_svg)) !== null) {
            const x = match[1]; 
            const y = match[2]; 
            const width = match[3]; 
            const height = match[4]; 
            const fontSize = match[5];
            const text = match[6];
            
            text_data.push({ x, y, width, height, fontSize, text });
        }
        return text_data
    } 

    let raw_svg = new XMLSerializer().serializeToString(svg);
    let text_data = get_text_data(raw_svg)
    let i = 1;

    let replacing_lists = [
        ['<g ', `<svg width="1500" height="950" `],
        ['</g>', '</svg>'],
        ['/class="([^"]*)"/', ''],
        ['/id="([^"]*)"/', ''],
    ]

    for (replacing_element of replacing_lists) {
        raw_svg = raw_svg.replace(new RegExp(replacing_element[0]), replacing_element[1]);
        i++;
    }

    for (let text of text_data) {
        const actual_y = Number(text.y) + Number(text.height) / 2;
        const actual_x = Number(text.x) + Number(text.width) / 2;
        raw_svg = raw_svg.replace(
            /<foreignObject[\s\S]*?<\/foreignObject>/,
            `<text x="${actual_x}" y="${actual_y}" fill="none" text-anchor="middle" stroke="black" font-size="${text.fontSize}">${text.text}</text>`
        );
    }

    return raw_svg;
}

const exportButton = document.getElementById('export-button');
const dropdownMenu = document.getElementById('export-dropdown-content');

exportButton.addEventListener('click', () => {
    const isVisible = dropdownMenu.style.display === 'block';
    dropdownMenu.style.display = isVisible ? 'none' : 'block';
});

document.addEventListener('click', (event) => {
    if (!event.target.closest('#export-dropdown')) {
        dropdownMenu.style.display = 'none';
    }
});