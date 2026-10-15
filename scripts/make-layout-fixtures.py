"""Anonymous layout regressions; never reads a student's source document."""
from pathlib import Path
import pymupdf as fitz

out = Path(__file__).resolve().parent.parent / 'tests' / 'fixtures'
font = Path('C:/Windows/Fonts/msyh.ttc')
demo_font=fitz.Font(fontfile=str(font))
out.mkdir(parents=True, exist_ok=True)

def page(doc):
    p = doc.new_page(width=842, height=595)
    p.insert_font(fontname='demo', fontfile=str(font))
    return p

def text(p, value, x, y, size=10, width=None):
    lines=[]
    for raw in value.split('\n'):
        line=''
        for char in raw:
            if width and line and demo_font.text_length(line+char, fontsize=size)>width:
                lines.append(line);line=''
            line+=char
        lines.append(line)
    for i, line in enumerate(lines):
        p.insert_text((x, y+i*(size+4)), line, fontname='demo', fontsize=size, color=(.1,.2,.18))

def cell(p,value,x,y,size=9):
    text(p,value,x,y,size,width=90)

xs = [25,100]+[100+i*102 for i in range(1,8)]
def grid(p, ys):
    for x in xs: p.draw_line((x,ys[0]),(x,ys[-1]),color=(.65,.7,.68),width=.5)
    for y in ys: p.draw_line((xs[0],y),(xs[-1],y),color=(.65,.7,.68),width=.5)

def headers(p):
    for day,c in enumerate('一二三四五六日'): text(p,'星期'+c,125+day*102,76,12)

doc=fitz.open();p=page(doc)
text(p,'匿名演示课表 - 跨页及合并单元格',250,32,17)
grid(p,[58,85,205,325,445,580]);headers(p)
for n,y in [(1,105),(2,165),(3,225),(4,285),(5,345),(6,405),(9,465),(10,525)]:text(p,str(n),62,y,12)
cell(p,'演示课程甲★\n(1-2节)3-18周/校区:演示校区/场\n地:C-201/教师:示例教师/教学\n班:示例班级/学分:2.0',208,105)
cell(p,'演示课程乙★\n(3-4节)13-16周/校区:演示校区\n/场地:D-302/教师:示例教师',208,225)
cell(p,'跨行课程名称\n后半段★\n(3-4节)2-16周(双)/场地:E-203\n/教师:示例教师',310,225)
cell(p,'下午演示课★\n(5-6节)1-16周/场地:F-204\n/教师:示例教师',106,345)
cell(p,'跨页晚课★\n(9-10节)3-18周/校区:演示校区',106,465)
cell(p,'跨页实验课★\n(9-11节)2-16周(双)/校区:演示校区',310,465)
p=page(doc);grid(p,[18,125,145,165])
cell(p,'/场地:G-305/教师:示例教师\n/教学班:演示班级/总学时:32',106,34)
cell(p,'/场地:H-306/教师:示例教师\n/教学班:演示班级/总学时:48',310,34)
text(p,'11',62,140,12);text(p,'12',62,161,12)
text(p,'其他课程：演示实习（17-18周，时间待定）',25,190)
text(p,'★: 讲课 ☆: 实验',25,215)
doc.subset_fonts();doc.save(out/'layout-multipage-demo.pdf',garbage=4,deflate=True);doc.close()

upright=fitz.open();p=page(upright)
text(p,'匿名演示课表 - 轮廓文字与侧转方向',240,30,17)
grid(p,[58,85,225,365,505,580]);headers(p)
for n,y,time in [(1,155,'08:30-09:15'),(2,295,'09:20-10:05'),(3,435,'10:25-11:10'),(4,550,'14:50-15:35')]:
    text(p,'第'+['一','二','三','四'][n-1]+'节',27,y-15,10);text(p,time,27,y+5,8)
for y in [108,248]:cell(p,'2-4,6-13周\n组合演示课(组合演示课01)\n示例教师\nA-101',106,y,10)
text(p,'3-15周(单)',310,388,12)
cell(p,'另一演示课(另一演示课02)\n示例教师\nB-202',310,414,10)
text(p,'2-12周',208,531,16)
p=page(upright);grid(p,[18,160,230])
cell(p,'跨页演示课(跨页演示课03)\n示例教师\nC-303',208,40,10)
text(p,'本学期已选但未安排时间地点的课程',25,260)
text(p,'课程名称     班级名称',100,285)
text(p,'未排期演示课    演示班级',100,310)
outlined=fitz.open()
for source in upright:
    svg=source.get_svg_image(text_as_path=True).encode()
    vector=fitz.open(stream=svg,filetype='svg');converted=fitz.open('pdf',vector.convert_to_pdf())
    target=outlined.new_page(width=595,height=842)
    target.show_pdf_page(target.rect,converted,0,rotate=90)
    converted.close();vector.close()
outlined.save(out/'rotated-outline-demo.pdf',garbage=4,deflate=True)
assert all(not p.get_text().strip() for p in outlined)
outlined.close();upright.close()
print('Created two anonymous layout PDFs: merged cells, wrapped names, cross-page continuation, odd/even weeks and rotated outlines.')
