
class EmojiAscii {

    constructor() {
        this.emojiBackgroundColor = '#313338'; // Equivalent to Color.FromRgb(49, 51, 56)
        this.emojiSize = 10;
        this.oklabCache = new Map();
        this.busy = false;
    }

    async imageToAscii(imagePath, emojisWide, emojisTall, printToElement, progressBar) {

        if(this.busy) {
          console.log("BUSY!!");
          return;
        }
        this.busy = true;

        this.emojisWide = emojisWide;
        this.emojisTall = emojisTall;

        const emojis = await this.loadJson('sources/emojis.json');
        const emojiIndexes = Array.from(emojis.keys());
        const tiles = await this.resizeSplit(imagePath);

        const resultEmojiIndexGrid = Array.from({ length: this.emojisWide }, () => Array(this.emojisTall).fill(0));
        const resultScoreGrid = Array.from({ length: this.emojisWide }, () => Array(this.emojisTall).fill(-1));

        let iterations = 0;
        const totalIterationsNeeded = emojiIndexes.length * tiles.length;
        let percent = 0;

        const printResults = () => {  // Use an arrow function here
            let result = '';
            for (let y = 0; y < this.emojisTall; y++) {
                for (let x = 0; x < this.emojisWide; x++) {
                    result += emojis[resultEmojiIndexGrid[x][y]];
                }
                result += '\n';
            }
            printToElement.dataset.twemoji = false;
            printToElement.innerText = result;

        };

        const promises = emojiIndexes.map(async (emojiIndex) => {

           // console.log("### emoji number " + emojiIndex)

            const emojiImage = await this.loadEmojiImage(emojiIndex);

            tiles.forEach((tile, index) => {
                const x = index % this.emojisWide;
                const y = Math.floor(index / this.emojisWide);
                const thisScore = this.calculateColorDifference(tile, emojiImage);
                //const thisScore = 5;
                if (resultScoreGrid[x][y] == -1 || thisScore < resultScoreGrid[x][y]) {
                    resultScoreGrid[x][y] = thisScore;
                    resultEmojiIndexGrid[x][y] = emojiIndex;
                    printResults();

                }

                iterations++;
                let newPercent = Math.floor(100 * iterations/totalIterationsNeeded)
                if(newPercent > percent)
                {
                    percent = newPercent;
                    console.log(percent/100 + "%")
                    progressBar.value = percent/100;

                }
            });
        });

        await Promise.all(promises);

        printToElement.dataset.twemoji = true;
        twemoji.parse(printToElement);

        this.busy = false;




    }



    async loadJson(path) {
        const response = await fetch(path);
        return response.json();
    }
    pathFromIndex(index) {
        return `sources/emojis/${index}.png`;
    }

    async resizeSplit(imagePath) {
        const originalImage = await this.loadImage(imagePath);
        const bigWidth = this.emojiSize * this.emojisWide; // Adjusting for width
        const bigHeight = this.emojiSize * this.emojisTall; // Adjusting for height

        // Create a canvas for resizing
        const canvas = document.createElement('canvas');
        canvas.width = bigWidth;
        canvas.height = bigHeight;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = this.emojiBackgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw the original image on the canvas
        ctx.drawImage(originalImage, 0, 0, bigWidth, bigHeight);

        const tiles = [];
        for (let y = 0; y < this.emojisTall; y++) {
            for (let x = 0; x < this.emojisWide; x++) {
                const imageData = ctx.getImageData(x * this.emojiSize, y * this.emojiSize, this.emojiSize, this.emojiSize);
                tiles.push(imageData);
            }
        }
        return tiles;
    }


    async loadEmojiImage(index) {
        const originalImage = await this.loadImage(this.pathFromIndex(index));

        // Create a canvas for resizing
        const canvas = document.createElement('canvas');
        canvas.width = this.emojiSize;
        canvas.height = this.emojiSize;
        const ctx = canvas.getContext('2d');

        // Draw the original image on the canvas
        ctx.drawImage(originalImage, 0, 0, this.emojiSize, this.emojiSize);

        return ctx.getImageData(0,0,this.emojiSize, this.emojiSize);
    }

    loadImage(path) {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = path;
            img.onload = () => resolve(img);
        });
    }

    calculateColorDifference(image1, image2) {

        if (!image1.data) {
            console.error("Image data is not loaded correctly.");
            return;
        }

        const width = image1.width;
        const height = image1.height;
    
       // console.log("Image1 dimensions:", width, height);
       // console.log("Image2 dimensions:", image2.width, image2.height);        
    
        let totalDifference = 0;
    
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = (y * width + x) * 4; // RGBA
                
                // Check if data is available at the index
                if (image1.data[index] === undefined || image2.data[index] === undefined) {
                    console.error(`Pixel data is undefined at index ${index} for (x=${x}, y=${y})`);
                    continue;  // Skip this pixel or handle it in some other way
                }
    
                const color1 = { r: image1.data[index], g: image1.data[index + 1], b: image1.data[index + 2] };
                const color2 = { r: image2.data[index], g: image2.data[index + 1], b: image2.data[index + 2] };
    
                totalDifference += this.colorDistanceSquared(color1, color2);
            }
        }
    
        return totalDifference / (width * height);
    }
    
    rgbToOklab(r, g, b) {
        const key = `${r},${g},${b}`; // Create a unique key for the RGB color

        // Check if the color is in the cache
        if (this.oklabCache.has(key)) {
            return this.oklabCache.get(key); // Return the cached OKLab value
        }

        function gammaCorrectedToLinear(c) {
            return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        }

        const rLinear = gammaCorrectedToLinear(r / 255);
        const gLinear = gammaCorrectedToLinear(g / 255);
        const bLinear = gammaCorrectedToLinear(b / 255);

        const lms = {
            l: 0.4122214708 * rLinear + 0.5363325363 * gLinear + 0.0514459929 * bLinear,
            m: 0.2119034982 * rLinear + 0.6806995451 * gLinear + 0.1073969566 * bLinear,
            s: 0.0883024619 * rLinear + 0.2817188376 * gLinear + 0.6299787005 * bLinear
        };

        const l = Math.cbrt(lms.l);
        const m = Math.cbrt(lms.m);
        const s = Math.cbrt(lms.s);

        const oklab = {
            L: 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
            a: 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
            b: 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
        };

        // Store the converted color in the cache
        this.oklabCache.set(key, oklab);

        return oklab; // Return the newly calculated OKLab value
    }

    colorDistanceSquared(color1, color2, quick = true) {
        if (quick) {
            // Calculate the squared distance using RGB values
            const deltaR = color1.r - color2.r;
            const deltaG = color1.g - color2.g;
            const deltaB = color1.b - color2.b;

            return deltaR ** 2 + deltaG ** 2 + deltaB ** 2;

        } else {
            // Convert to OKLab and calculate the squared distance
            const oklab1 = this.rgbToOklab(color1.r, color1.g, color1.b);
            const oklab2 = this.rgbToOklab(color2.r, color2.g, color2.b);
    
            const deltaL = oklab1.L - oklab2.L;
            const deltaA = oklab1.a - oklab2.a;
            const deltaB = oklab1.b - oklab2.b;
    
            return deltaL ** 2 + deltaA ** 2 + deltaB ** 2;
        }
    }
}

let printToElement = document.getElementById('textDiv');
let progressBar = document.getElementById('progress');
let fileInput = document.getElementById('file-input');
let uploadLabel = document.getElementById('uploadLabel');
let widthInput = document.getElementById('input-number1');
let heightInput = document.getElementById('input-number2')
let submitButton = document.getElementById('submit')
let emojiAsciiObject = new EmojiAscii();
let file;

// Common event handler for both inputs
let sizeChange = false;
const widthHeightChange = () => {
  if(!file) {
    return;
  }
  if(emojiAsciiObject.busy)
  {
    sizeChange = true; //will enable the button when emoji ascii finishes
    return;
  }
  submitButton.disabled = false;
  sizeChange = false;
};

// Add the same event listener to both inputs
widthInput.addEventListener('input', widthHeightChange);
heightInput.addEventListener('input', widthHeightChange);

submitButton.addEventListener('click', () => {
    ConvertImage();
});


fileInput.addEventListener('change', async (event) => {

    console.log("uploaded smth");

    file = event.target.files[0]; // Get the uploaded file
    ConvertImage();

})

function ConvertImage() {


    if (!file) {
      alert('invalid file');
      return;
    }
    
    let width = parseInt(widthInput.value, 10);  // Parse as an integer
    let height = parseInt(heightInput.value, 10); // Parse as an intege
    
    if(!width || !height || width < 1 || height < 1) {
      alert('invalid height or width');
      return;
    }
    
    if(width >= 50 || height >= 50) {
      alert('width and height must be below 50');
      return;
    }
    
    if(emojiAsciiObject.busy) {
      alert("WAIT");
      return;
    }
    
    submitButton.disabled = true;
    uploadLabel.dataset.disabled = "true";
    fileInput.disabled = true;

    const reader = new FileReader();
    
    // When the file is read, load the image
    reader.onload = async (e) => {
        const imagePath = e.target.result; // The image data URL
        console.log(imagePath);

        await emojiAsciiObject.imageToAscii(imagePath, width, height, printToElement, progressBar);

        uploadLabel.dataset.disabled = "false";
        fileInput.disabled = false;
        if(sizeChange) {
          widthHeightChange();
        }
    };

    reader.readAsDataURL(file); // This line reads the file
}