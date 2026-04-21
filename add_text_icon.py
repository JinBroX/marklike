from PIL import Image, ImageDraw, ImageFont

# 加载原始logo
img = Image.open('logo.png').convert('RGBA')

# 创建512尺寸的版本
img_512 = img.resize((512, 512), Image.Resampling.LANCZOS)

# 添加文字
draw = ImageDraw.Draw(img_512)

# 使用默认字体
font = ImageFont.load_default()

text = "mark like"
# 计算文字位置（底部居中）
bbox = draw.textbbox((0, 0), text, font=font)
text_w = bbox[2] - bbox[0]
text_h = bbox[3] - bbox[1]
x = (512 - text_w) // 2
y = 512 - text_h - 30

# 白色文字
draw.text((x, y), text, fill='white', font=font)

# 保存512
img_512.save('icon-512.png', 'PNG')

# 创建192尺寸的版本
img_192 = img.resize((192, 192), Image.Resampling.LANCZOS)
draw192 = ImageDraw.Draw(img_192)
font192 = ImageFont.load_default()
bbox192 = draw192.textbbox((0, 0), text, font=font192)
text_w192 = bbox192[2] - bbox192[0]
text_h192 = bbox192[3] - bbox192[1]
x192 = (192 - text_w192) // 2
y192 = 192 - text_h192 - 10
draw192.text((x192, y192), text, fill='white', font=font192)
img_192.save('icon-192.png', 'PNG')

print('Done with text!')
