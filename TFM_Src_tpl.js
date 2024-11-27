var app = ( function() {

	var gl;

	// The shader program object is also used to
	// store attribute and uniform locations.
	var prog;

	// Array of model objects.
	var models = [];

	// Model that is target for user input.
	var interactiveModel;

	var camera = {
		// Initial position of the camera.
		eye : [0, 1, 4],
		// Point to look at.
		center : [0, 0, 0],
		// Roll and pitch of the camera.
		up : [0, 1, 0],
		// Opening angle given in radian.
		// radian = degree*2*PI/360.
		fovy : 60.0 * Math.PI / 180,
		// Camera near plane dimensions:
		// value for left right top bottom in projection.
		lrtb : 2.0,
		// View matrix.
		vMatrix : mat4.create(),
		// Projection matrix.
		pMatrix : mat4.create(),
		// Projection types: ortho, perspective, frustum.
		projectionType : "perspective",
		// Angle to Z-Axis for camera when orbiting the center
		// given in radian.
		zAngle : 0,
		// Distance in XZ-Plane from center when orbiting.
		distance : 6,
	};

	// Globale Variablen für die Zeitsteuerung.
var time = 0;
// Animationsgeschwindigkeitsfaktor.
var animationSpeed = 0.01;

var torusRotationSpeed = 0.5;

var animationActive = true; // Steuerung der Animation (aktiv oder pausiert)
var animationFrameId;       // Speichert die ID des aktuellen Animationsframes


	function start() {
		init();
		render();
	}

	function init() {
		initWebGL();
		initShaderProgram();
		initUniforms()
		initModels();
		initEventHandler();
		initPipline();
	}

	function initWebGL() {
		// Get canvas and WebGL context.
		canvas = document.getElementById('canvas');
		gl = canvas.getContext('experimental-webgl');
		gl.viewportWidth = canvas.width;
		gl.viewportHeight = canvas.height;
	}

	/**
	 * Init pipeline parameters that will not change again. 
	 * If projection or viewport change, their setup must
	 * be in render function.
	 */
	function initPipline() {
		gl.clearColor(.95, .95, .95, 1);

		// Backface culling.
		gl.frontFace(gl.CCW);
		gl.enable(gl.CULL_FACE);
		gl.cullFace(gl.BACK);

		// Depth(Z)-Buffer.
		gl.enable(gl.DEPTH_TEST);

		// Polygon offset of rastered Fragments.
		gl.enable(gl.POLYGON_OFFSET_FILL);
		gl.polygonOffset(0.5, 0);

		// Set viewport.
		gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);

		// Init camera.
		// Set projection aspect ratio.
		camera.aspect = gl.viewportWidth / gl.viewportHeight;
	}

	function initShaderProgram() {
		// Init vertex shader.
		var vs = initShader(gl.VERTEX_SHADER, "vertexshader");
		// Init fragment shader.
		var fs = initShader(gl.FRAGMENT_SHADER, "fragmentshader");
		// Link shader into a shader program.
		prog = gl.createProgram();
		gl.attachShader(prog, vs);
		gl.attachShader(prog, fs);
		gl.bindAttribLocation(prog, 0, "aPosition");
		gl.linkProgram(prog);
		gl.useProgram(prog);
	}

	/**
	 * Create and init shader from source.
	 * 
	 * @parameter shaderType: openGL shader type.
	 * @parameter SourceTagId: Id of HTML Tag with shader source.
	 * @returns shader object.
	 */
	function initShader(shaderType, SourceTagId) {
		var shader = gl.createShader(shaderType);
		var shaderSource = document.getElementById(SourceTagId).text;
		gl.shaderSource(shader, shaderSource);
		gl.compileShader(shader);
		if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			console.log(SourceTagId + ": " + gl.getShaderInfoLog(shader));
			return null;
		}
		return shader;
	}

	function initUniforms() {
		// Projection Matrix.
		prog.pMatrixUniform = gl.getUniformLocation(prog, "uPMatrix");

		// Model-View-Matrix.
		prog.mvMatrixUniform = gl.getUniformLocation(prog, "uMVMatrix");

		prog.colorUniform = gl.getUniformLocation(prog, "uColor");

		prog.nMatrixUniform = gl.getUniformLocation(prog, "uNMatrix");
	}

	function initModels() {
    var fs = "fill";

    // Torus erstellen
    createModel("torus", fs, [1, 1, 1, 1], [0, 0, 0], [0, 0, 0], [1, 1, 1], "torus");

    // Ebene erstellen
    createModel("plane", "wireframe", [1, 1, 1, 1], [0, -3, 0], [0, 0, 0], [1, 1, 1], "plane");

    // Kugeln erstellen mit unterschiedlichen Phasenverschiebungen und Mittelpunktswinkeln
    createModel("sphere", fs, [1, 0, 0, 1], [0, 0, 0], [0, 0, 0], [0.2, 0.2, 0.2], "sphere", 0, 0);
    createModel("sphere", fs, [0, 1, 0, 1], [0, 0, 0], [0, 0, 0], [0.2, 0.2, 0.2], "sphere", Math.PI / 2, Math.PI / 2);
    createModel("sphere", fs, [0, 0, 1, 1], [0, 0, 0], [0, 0, 0], [0.2, 0.2, 0.2], "sphere", Math.PI, Math.PI);
    createModel("sphere", fs, [1, 1, 0, 1], [0, 0, 0], [0, 0, 0], [0.2, 0.2, 0.2], "sphere", 3 * Math.PI / 2, 3 * Math.PI / 2);

    interactiveModel = models[0];
}




	/**
	 * Create model object, fill it and push it in models array.
	 * 
	 * @parameter geometryname: string with name of geometry.
	 * @parameter fillstyle: wireframe, fill, fillwireframe.
	 */
	function createModel(geometryname, fillstyle, color, translate, rotate, scale, type, phaseShift, theta) {
    var model = {};
    model.type = type;
    model.phaseShift = phaseShift || 0;
    model.theta = theta || 0; // Winkel für den Mittelpunkt der Kugelbahn auf dem Torus
    model.fillstyle = fillstyle;
    model.color = color;
    initDataAndBuffers(model, geometryname);
    initTransformations(model, translate, rotate, scale);

    models.push(model);
}


	/**
	 * Set scale, rotation and transformation for model.
	 */
	function initTransformations(model, translate, rotate, scale) {
		// Store transformation vectors.
		model.translate = translate;
		model.rotate = rotate;
		model.scale = scale;

		// Create and initialize Model-Matrix.
		model.mMatrix = mat4.create();

		// Create and initialize Model-View-Matrix.
		model.mvMatrix = mat4.create();

		model.nMatrix = mat3.create();
	}

	/**
	 * Init data and buffers for model object.
	 * 
	 * @parameter model: a model object to augment with data.
	 * @parameter geometryname: string with name of geometry.
	 */
	function initDataAndBuffers(model, geometryname) {
		// Provide model object with vertex data arrays.
		// Fill data arrays for Vertex-Positions, Normals, Index data:
		// vertices, normals, indicesLines, indicesTris;
		// Pointer this refers to the window.
		this[geometryname]['createVertexData'].apply(model);

		// Setup position vertex buffer object.
		model.vboPos = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, model.vboPos);
		gl.bufferData(gl.ARRAY_BUFFER, model.vertices, gl.STATIC_DRAW);
		// Bind vertex buffer to attribute variable.
		prog.positionAttrib = gl.getAttribLocation(prog, 'aPosition');
		gl.enableVertexAttribArray(prog.positionAttrib);

		// Setup normal vertex buffer object.
		model.vboNormal = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, model.vboNormal);
		gl.bufferData(gl.ARRAY_BUFFER, model.normals, gl.STATIC_DRAW);
		// Bind buffer to attribute variable.
		prog.normalAttrib = gl.getAttribLocation(prog, 'aNormal');
		gl.enableVertexAttribArray(prog.normalAttrib);

		// Setup lines index buffer object.
		model.iboLines = gl.createBuffer();
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.iboLines);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, model.indicesLines, 
			gl.STATIC_DRAW);
		model.iboLines.numberOfElements = model.indicesLines.length;
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

		// Setup triangle index buffer object.
		model.iboTris = gl.createBuffer();
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.iboTris);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, model.indicesTris, 
			gl.STATIC_DRAW);
		model.iboTris.numberOfElements = model.indicesTris.length;
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
	}

	function initEventHandler() {
		// Rotation step.
		var deltaRotate = Math.PI / 36;
		var deltaTranslate = 0.05;
		var deltaScale = 0.05;

		window.onkeydown = function (evt) {
    var key = evt.which ? evt.which : evt.keyCode;
    var c = String.fromCharCode(key);
    var sign = evt.shiftKey ? -1 : 1;

    switch (c) {
        
        case 'C':
            camera.zAngle += sign * deltaRotate;
            break;
        case 'H':
            camera.eye[1] += sign * deltaTranslate;
            break;
        case 'D':
            camera.distance += sign * deltaTranslate;
            break;
        case 'V':
            camera.fovy += sign * 5 * Math.PI / 180;
            break;
        
        case 'K':
            animationActive = !animationActive;
            if (animationActive) {
                render(); // Animation starten
            } else if (animationFrameId) {
                cancelAnimationFrame(animationFrameId); // Animation pausieren
            }
            return;
    }

    // Szene neu rendern, falls Animation pausiert ist
    if (!animationActive) {
        manualRender();
    }
};


	}

	

	/**
	 * Run the rendering pipeline.
	 */
	function render() {
    if (!animationActive) {
        return; // Beendet die Funktion, wenn die Animation pausiert ist
    }

    // Update time.
    time += animationSpeed;

    // Clear framebuffer and depth-/z-buffer.
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    setProjection();

    calculateCameraOrbit();

    mat4.lookAt(camera.vMatrix, camera.eye, camera.center, camera.up);

    var sphereStartIndex = 2;

    for (var i = 0; i < models.length; i++) {
        if (models[i].type === "sphere") {
            updateSpherePosition(models[i], i - sphereStartIndex);
        }

        updateTransformations(models[i]);

        gl.uniformMatrix4fv(prog.mvMatrixUniform, false, models[i].mvMatrix);
        gl.uniform4fv(prog.colorUniform, models[i].color);
        gl.uniformMatrix3fv(prog.nMatrixUniform, false, models[i].nMatrix);

        draw(models[i]);
    }

    // Request the next frame only if the animation is active.
    animationFrameId = requestAnimationFrame(render);
}




function manualRender() {
    // Clear framebuffer and depth-/z-buffer.
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    setProjection();

    calculateCameraOrbit();

    mat4.lookAt(camera.vMatrix, camera.eye, camera.center, camera.up);

    var sphereStartIndex = 2;

    for (var i = 0; i < models.length; i++) {
        if (models[i].type === "sphere") {
            updateSpherePosition(models[i], i - sphereStartIndex);
        }

        updateTransformations(models[i]);

        gl.uniformMatrix4fv(prog.mvMatrixUniform, false, models[i].mvMatrix);
        gl.uniform4fv(prog.colorUniform, models[i].color);
        gl.uniformMatrix3fv(prog.nMatrixUniform, false, models[i].nMatrix);

        draw(models[i]);
    }
}





// Neue Funktion zum Aktualisieren der Positionen der Kugeln.
function updateSpherePosition(model, index) {
    var R = 1.5; // Großer Radius des Torus
    var angularSpeed = 1.0;
    var angle = angularSpeed * time + model.phaseShift;

    // Mittelpunkt der Kugelbahn auf dem Torus
    var centerX = R * Math.cos(model.theta);
    var centerY = R * Math.sin(model.theta);
    var centerZ = 0;

    // Richtung vom Mittelpunkt der Kugelbahn zum Ursprung
    var dirX = -centerX;
    var dirY = -centerY;
    var dirZ = -centerZ;

    // Normalisieren der Richtungsvektoren
    var dirLength = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);
    dirX /= dirLength;
    dirY /= dirLength;
    dirZ /= dirLength;

    // Radius der Kugelbahn
    var radius = 1;

    // Position der Kugel auf ihrer Bahn
    var x = centerX + radius * Math.cos(angle) * dirX;
    var y = centerY + radius * Math.cos(angle) * dirY;
    var z = radius * Math.sin(angle);

    // Position des Modells aktualisieren
    model.translate[0] = x;
    model.translate[1] = y;
    model.translate[2] = z;
}





	function calculateCameraOrbit() {
		// Calculate x,z position/eye of camera orbiting the center.
		var x = 0, z = 2;
		camera.eye[x] = camera.center[x];
		camera.eye[z] = camera.center[z];
		camera.eye[x] += camera.distance * Math.sin(camera.zAngle);
		camera.eye[z] += camera.distance * Math.cos(camera.zAngle);
	}

	function setProjection() {
		// Set projection Matrix.
		switch(camera.projectionType) {
			case("ortho"):
				var v = camera.lrtb;
				mat4.ortho(camera.pMatrix, -v, v, -v, v, -10, 10);
				break;
			case("frustum"):
				var v = camera.lrtb;
				mat4.frustum(camera.pMatrix, -v/2, v/2, -v/2, v/2, 1, 10);
				break;
			case("perspective"):
				mat4.perspective(camera.pMatrix, camera.fovy, 
					camera.aspect, 1, 10);
				break;
		}
		// Set projection uniform.
		gl.uniformMatrix4fv(prog.pMatrixUniform, false, camera.pMatrix);
	}

	/**
	 * Update model-view matrix for model.
	 */
	function updateTransformations(model) {
    // Use shortcut variables.
    var mMatrix = model.mMatrix;
    var mvMatrix = model.mvMatrix;

    // Reset matrices to identity.
    mat4.identity(mMatrix);
    mat4.identity(mvMatrix);

    // Translate.
    mat4.translate(mMatrix, mMatrix, model.translate);

    // Rotate.
    if (model.type === "torus") {
        // Rotiert den Torus um die X-Achse abhängig von der Zeit.
        mat4.rotateX(mMatrix, mMatrix, time * torusRotationSpeed);
    }

    // Führen Sie die standardmäßigen Rotationen aus.
    mat4.rotateX(mMatrix, mMatrix, model.rotate[0]);
    mat4.rotateY(mMatrix, mMatrix, model.rotate[1]);
    mat4.rotateZ(mMatrix, mMatrix, model.rotate[2]);

    // Scale.
    mat4.scale(mMatrix, mMatrix, model.scale);

    // Combine view and model matrix by matrix multiplication to mvMatrix.
    mat4.multiply(mvMatrix, camera.vMatrix, mMatrix);

    // Calculate normal matrix from model-view matrix.
    mat3.normalFromMat4(model.nMatrix, mvMatrix);
}



	function draw(model) {
		// Setup position VBO.
		gl.bindBuffer(gl.ARRAY_BUFFER, model.vboPos);
		gl.vertexAttribPointer(prog.positionAttrib, 3, gl.FLOAT, false, 
			0, 0);

		// Setup normal VBO.
		gl.bindBuffer(gl.ARRAY_BUFFER, model.vboNormal);
		gl.vertexAttribPointer(prog.normalAttrib, 3, gl.FLOAT, false, 0, 0);

		// Setup rendering tris.
		var fill = (model.fillstyle.search(/fill/) != -1);
		if(fill) {
			gl.enableVertexAttribArray(prog.normalAttrib);
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.iboTris);
			gl.drawElements(gl.TRIANGLES, model.iboTris.numberOfElements, 
				gl.UNSIGNED_SHORT, 0);
		}

		// Setup rendering lines.
		var wireframe = (model.fillstyle.search(/wireframe/) != -1);
		if(wireframe) {
			gl.disableVertexAttribArray(prog.normalAttrib);
			gl.vertexAttrib3f(prog.normalAttrib, 0, 0, 0);
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.iboLines);
			gl.drawElements(gl.LINES, model.iboLines.numberOfElements, 
				gl.UNSIGNED_SHORT, 0);
		}
	}

	// App interface.
	return {
		start : start
	}

}());