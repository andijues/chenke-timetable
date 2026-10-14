from pathlib import Path
import fitz

out = Path(__file__).resolve().parent.parent / 'tests' / 'fixtures'
out.mkdir(parents=True, exist_ok=True)
doc = fitz.open()
page = doc.new_page(width=840, height=594)
font = Path('C:/Windows/Fonts/msyh.ttc')
page.insert_font(fontname='school', fontfile=str(font))
def text(value, x, y, size=12):
    page.insert_text((x, y), value, fontname='school', fontsize=size, color=(.1,.25,.2))
text('演示课表 - 用于软件导入验证', 80, 35, 18)
cols = [0, 85, 225, 365, 505, 645, 785]
for x in cols[1:]: page.draw_line((x,60),(x,540),color=(.7,.8,.75),width=.6)
for y in [60,105,230,355,480,540]: page.draw_line((85,y),(785,y),color=(.7,.8,.75),width=.6)
for i, day in enumerate(['周一','周二','周三','周四','周五']): text(day, 141+i*140, 87)
for i, period in enumerate(['1-2节','3-4节','5-6节']): text(period,24,155+i*125)
fixtures = [('高等数学',0,0,'08:30-10:10','1-16周','理学楼A302'),('学术英语',1,0,'09:00-10:10','1-16周','文科楼B201'),('数据结构',2,1,'10:30-12:10','1-16周(单)','信息楼406'),('专业实验',4,2,'14:00-15:40','1-16周','实验楼204')]
for name,day,row,time,weeks,location in fixtures:
    x=99+day*140; y=137+row*125
    for j,line in enumerate([name,time,weeks,location]): text(line,x,y+j*19,12)
doc.save(out/'sample-timetable.pdf')
pix=page.get_pixmap(matrix=fitz.Matrix(2,2),alpha=False)
pix.save(out/'sample-timetable.png')
scan=fitz.open();p=scan.new_page(width=840,height=594);p.insert_image(p.rect,stream=pix.tobytes('png'));scan.save(out/'sample-scanned.pdf');scan.close();doc.close()
print('已生成文字 PDF、PNG 与扫描 PDF 三个演示样本。')
