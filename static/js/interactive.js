class InteractiveCanvas {
  constructor (inputField, lineMargin, near, far) {
    this.inputField = inputField; // The canvas input field to display and fetch chromosome range from

    // Box variables
    this.titleMargin = 60; // Margin between box and title
    this.legendMargin = 45; // Margin between legend and box
    this.xMargin = 2; // margin for x-axis in graph
    this.yMargin = 5; // margin for top and bottom in graph
    this.extraWidth = $(document).innerWidth(); // Width for loading in extra edge data
    this.boxWidth = 0.9 * $(document).innerWidth() - this.legendMargin; // Width of one box
    this.boxHeight = 180; // Height of one box
    this.y = 10 + 2 * lineMargin + this.titleMargin; // Y-position for first box
    this.width = Math.max(this.boxWidth + 2 * this.extraWidth, $(document).innerWidth()); // Canvas width
    this.height = 2 + this.y + 2 * (this.xMargin + this.boxHeight); // Canvas height
    this.x = this.width / 2 - this.boxWidth / 2; // X-position for first box
    this.xAmpl = this.boxWidth - 2 * this.xMargin; // Part of amplitude for scaling x-axis to fill whole box width
    this.moveImg = null; // Placeholder for image copy of contentCanvas

    // Canvases
    this.drawCanvas = new OffscreenCanvas(parseInt(this.width), parseInt(this.height));
    this.context = this.drawCanvas.getContext('webgl2');
    this.contentCanvas = document.getElementById('interactive-content');
    this.staticCanvas = document.getElementById('interactive-static');

    // Data values
    this.chromosome = null;
    this.start = null;
    this.end = null;
    this.disallowDrag = false;

    // WebGL scene variables
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(this.width / -2, this.width / 2,
      this.height / -2, this.height / 2, near, far);
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.drawCanvas,
      context: this.context,
      antialiasing: true
    });

    // Change to fourth quadrant of scene
    this.camera.position.x = this.width / 2 - lineMargin;
    this.camera.position.y = this.height / 2 - lineMargin;
    this.camera.position.z = 1;

    // Set dimensions of overview canvases
    this.staticCanvas.width = this.width;
    this.staticCanvas.height = this.height;
    this.contentCanvas.width = this.width;
    this.contentCanvas.height = this.height;

    this.staticCanvas.getContext('2d').clearRect(0, 0, this.width, this.height); // TODO: remove this?
  }

  // Draw static content for interactive canvas
  drawStaticContent (ic, baf, logr) {
    let linePadding = 2;
    // Fill background colour
    ic.staticCanvas.getContext('2d').fillStyle = 'white';
    ic.staticCanvas.getContext('2d').fillRect(0, 0, ic.width, ic.height);

    // Make content area visible
    ic.staticCanvas.getContext('2d').clearRect(ic.x + linePadding,
      ic.y + linePadding, ic.boxWidth, ic.width);
    ic.staticCanvas.getContext('2d').clearRect(0, 0, ic.width,
      ic.y + linePadding);

    ic.staticCanvas.getContext('2d').fillStyle = 'black';
    // Draw rotated y-axis legends
    drawRotatedText(ic.staticCanvas, 'B Allele Freq', 18, ic.x - ic.legendMargin,
      ic.y + ic.boxHeight / 2, -Math.PI / 2);
    drawRotatedText(ic.staticCanvas, 'Log R Ratio', 18, ic.x - ic.legendMargin,
      ic.y + 1.5 * ic.boxHeight, -Math.PI / 2);

    // Draw BAF
    createGraph(ic.scene, ic.staticCanvas, ic.x, ic.y, ic.boxWidth, ic.boxHeight,
      ic.yMargin, baf.yStart, baf.yEnd, baf.step, true);

    // Draw LogR
    createGraph(ic.scene, ic.staticCanvas, ic.x, ic.y + ic.boxHeight, ic.boxWidth,
      ic.boxHeight, ic.yMargin, logr.yStart, logr.yEnd, logr.step, true);

    ic.renderer.render(ic.scene, ic.camera);

    // Transfer image to visible canvas
    ic.staticCanvas.getContext('2d').drawImage(
      ic.drawCanvas.transferToImageBitmap(), 0, 0);

    // Clear scene for next render
    ic.scene.remove.apply(ic.scene, ic.scene.children);
  }

  // Draw values for interactive canvas
  drawInteractiveContent (ic, baf, logr, logRMedian) {
    $.getJSON($SCRIPT_ROOT + '/_getoverviewcov', {
      region: document.getElementById('region_field').placeholder,
      median: logRMedian,
      xpos: ic.x + ic.xMargin,
      ypos: ic.y,
      boxHeight: ic.boxHeight,
      extra_box_width: ic.extraWidth,
      y_margin: ic.yMargin,
      x_ampl: ic.xAmpl
    }, function (result) {
      // Clear canvas
      ic.contentCanvas.getContext('2d').clearRect(0, 0,
        ic.contentCanvas.width, ic.contentCanvas.height);

      // Draw ticks for x-axis
      let ampl = (ic.boxWidth) / (result['start'] - result['end']);
      drawVerticalTicks(ic.scene, ic.contentCanvas, ic.x, ic.y,
        result['start'], result['end'], ic.boxWidth,
        Math.floor((result['end'] - result['start']) / 20), ampl, ic.yMargin);

      // Draw horizontal lines for BAF and LogR
      drawGraphLines(ic.scene, 0, result['y_pos'],
        baf.yStart, baf.yEnd, baf.step, ic.yMargin, ic.width, ic.boxHeight);
      drawGraphLines(ic.scene, 0, result['y_pos'] + ic.boxHeight,
        logr.yStart, logr.yEnd, logr.step, ic.yMargin, ic.width, ic.boxHeight);

      // Plot scatter data
      drawData(ic.scene, result['baf'], baf.color);
      drawData(ic.scene, result['data'], logr.color);
      ic.renderer.render(ic.scene, ic.camera);

      // Draw chromosome title
      drawText(ic.contentCanvas,
        result['x_pos'] - ic.xMargin + ic.boxWidth / 2,
        result['y_pos'] - ic.titleMargin,
        'Chromosome ' + result['chrom'], 'bold 15', 'center');

      // Transfer image to visible canvas
      ic.contentCanvas.getContext('2d').drawImage(
        ic.drawCanvas.transferToImageBitmap(), 0, 0);

      // Clear scene before drawing
      ic.scene.remove.apply(ic.scene, ic.scene.children);

      // Set values
      ic.chromosome = result['chrom'];
      ic.start = result['start'];
      ic.end = result['end'];
      ic.inputField.placeholder = ic.chromosome + ':' + ic.start + '-' + ic.end;
    }).done(function () {
      ic.inputField.blur();
    }).fail(function (result) {
      console.log('Bad input');
      ic.inputField.placeholder = 'Bad input: ' + ic.inputField.placeholder;
      ic.inputField.value = '';
    });
  }

  // Redraw interactive canvas
  redraw (ic, baf, logr, logRMedian) {
    ic.disallowDrag = false;
    ic.inputField.placeholder = ic.chromosome + ':' + ic.start + '-' + ic.end;
    ic.drawInteractiveContent(ic, baf, logr, logRMedian);
  }
}