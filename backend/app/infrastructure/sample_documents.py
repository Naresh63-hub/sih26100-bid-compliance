from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
ROOT=Path(__file__).resolve().parents[3]
SAMPLES={
 'sample_tenders/industrial-pump-tender.pdf':('Industrial Pump Supply & Commissioning',[
 ['FICTIONAL PSU TENDER | BG-2026-014','South Coast Process Utilities (fictional organization)','Assessment date: 2026-09-09 | Deadline: 2026-09-30','Minimum experience: 5 years','Minimum turnover: 5 crore','Minimum local content: 50%','Minimum warranty: 24 months','GST registration must be verified.'],
 ['PAN must be verified.','Udyam certificate is required.','OEM expiry must be on or after 2026-09-30.','Minimum completed projects: 3 projects','Project must be government and similar; minimum value: 5 crore; completed within 5 years.']]),
 'sample_bids/company-profile.pdf':('Vayuna Engineering | Company Profile',[
 ['FICTIONAL BIDDER DOCUMENT','Company name: Vayuna Engineering Pvt. Ltd.'],['Experience: 7 years','Completed projects: 4 projects']]),
 'sample_bids/financial-statement.pdf':('Vayuna Engineering | Financial Statement',[
 ['FICTIONAL FINANCIAL STATEMENT','Company name: Vayuna Engineering Pvt. Ltd.','Financial year: 2025-26'],['Annual turnover: 3.8 crore']]),
 'sample_bids/technical-proposal.pdf':('Vayuna Engineering | Technical Proposal',[
 ['FICTIONAL TECHNICAL OFFER','Company name: Vayuna Engineering Pvt. Ltd.'],['Local content: 62%','Warranty: 24 months','OEM expiry: 2026-08-31']]),
 'sample_bids/registration-evidence.pdf':('Vayuna Engineering | Registration Evidence',[
 ['FICTIONAL REGISTRATION EVIDENCE','Company name: Vayuna Engineering Pvt. Ltd.'],['GST: DEMO-GST-VAYUNA','PAN: DEMO-PAN-VAYUNA','No live registry authentication is represented by this document.']]),
 'sample_bids/completion-certificates.pdf':('Vayuna Engineering | Project Completion',[
 ['FICTIONAL PROJECT RECORD','Company name: Vayuna Engineering Pvt. Ltd.'],['Completed projects: 6 projects','Project: government=true; similar=true; value=7 crore; completed=2024-06-01']])
}
def generate_samples():
 for filename,(title,pages) in SAMPLES.items():
  target=ROOT/'data'/filename;target.parent.mkdir(parents=True,exist_ok=True)
  c=canvas.Canvas(str(target),pagesize=A4);c.setTitle(title)
  for index,lines in enumerate(pages,1):
   c.setFillColor(colors.HexColor('#143e31'));c.rect(0,A4[1]-115,A4[0],115,fill=1,stroke=0)
   c.setFillColor(colors.HexColor('#c4eb83'));c.setFont('Helvetica-Bold',20);c.drawString(45,A4[1]-46,'BIDGUARD')
   c.setFillColor(colors.white);c.setFont('Helvetica',12);c.drawString(45,A4[1]-78,title)
   c.setFillColor(colors.HexColor('#35493b'));y=A4[1]-158
   for line in lines:c.setFont('Helvetica',10);c.drawString(45,y,line);y-=28
   c.setFont('Helvetica',9);c.setFillColor(colors.HexColor('#788773'));c.drawString(45,40,'Synthetic SIH demonstration. Not an authentic government or financial document.');c.drawRightString(A4[0]-45,24,f'Page {index}');c.showPage()
  c.save()
if __name__=='__main__':generate_samples()
