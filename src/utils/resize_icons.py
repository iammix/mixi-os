from PIL import Image

# Load the images
icon_path_1 = "/Users/KostasM/Repositories/mixi-os/src/assets/icons/showcase2.png"

# Open images
icon1 = Image.open(icon_path_1)

# Resize images to 32x32 pixels
icon1_resized = icon1.resize((32, 32))

# Save resized images
resized_icon1_path = "/Users/KostasM/Repositories/mixi-os/src/assets/icons/showcase2.png"

icon1_resized.save(resized_icon1_path)
