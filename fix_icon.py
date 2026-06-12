import sys
import os

try:
    from PIL import Image
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
    from PIL import Image

def create_adaptive_icon():
    base_dir = r"c:\Users\biswa\Downloads\FILLOSOFT\storeman mobile\store-mobile\assets"
    icon_path = os.path.join(base_dir, "icon.png")
    adaptive_path = os.path.join(base_dir, "adaptive-icon.png")
    
    print(f"Loading {icon_path}...")
    img = Image.open(icon_path).convert("RGBA")
    
    # Target size is 1024x1024
    target_size = 1024
    # Scale image to 60% of the target size to fit well within Android's safe zone (66%)
    scaled_size = int(target_size * 0.55)
    
    img.thumbnail((scaled_size, scaled_size), Image.Resampling.LANCZOS)
    
    # Create new transparent canvas
    new_img = Image.new("RGBA", (target_size, target_size), (255, 255, 255, 0))
    
    # Paste centered
    offset_x = (target_size - img.width) // 2
    offset_y = (target_size - img.height) // 2
    
    new_img.paste(img, (offset_x, offset_y), img)
    
    print(f"Saving to {adaptive_path}...")
    new_img.save(adaptive_path, "PNG")
    print("Done!")

if __name__ == "__main__":
    create_adaptive_icon()
