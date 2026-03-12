from PIL import Image
import os

input_path = r'C:\Users\anpan\.gemini\antigravity\brain\7939d409-76c9-4713-80f8-fb260da71b3c\horror_headless_body_transparent_bg_1773321804957.png'
output_path = r'C:\Users\anpan\.gemini\elevator-game\client\public\body.png'

try:
    img = Image.open(input_path)
    img = img.convert("RGBA")
    datas = img.getdata()

    newData = []
    for item in datas:
        # Green background removal logic
        # item is (R, G, B, A)
        # We look for pixels where G is significantly higher than R and B
        if item[1] > 150 and item[1] > item[0] + 30 and item[1] > item[2] + 30:
            newData.append((255, 255, 255, 0))
        else:
            newData.append(item)

    img.putdata(newData)
    img.save(output_path, "PNG")
    print(f"Successfully saved transparent image to {output_path}")
except Exception as e:
    print(f"Error: {e}")
