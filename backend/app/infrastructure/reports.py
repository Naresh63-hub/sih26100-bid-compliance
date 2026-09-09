from io import BytesIO
from xml.sax.saxutils import escape
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, PageBreak

def report_pdf(assessment: dict, bid: dict) -> bytes:
    stream=BytesIO();styles=getSampleStyleSheet()
    styles.add(ParagraphStyle(name='BGTitle',fontName='Helvetica-Bold',fontSize=24,leading=29,textColor=colors.HexColor('#123f32'),spaceAfter=15))
    styles.add(ParagraphStyle(name='BGBody',fontName='Helvetica',fontSize=9,leading=14,spaceAfter=7))
    styles.add(ParagraphStyle(name='BGSmall',fontName='Helvetica',fontSize=8,leading=12,textColor=colors.HexColor('#53695e'),spaceAfter=5))
    styles['Heading2'].textColor=colors.HexColor('#173f31');styles['Heading2'].fontSize=13;styles['Heading2'].spaceBefore=16
    def p(text,style='BGBody'):
        clean=str(text).replace('₹','INR ').replace('≥','>=').replace('→',' -> ').replace('—','-').replace('–','-')
        return Paragraph(escape(clean).replace('\n','<br/>'),styles[style])
    risk=bid['risk'];story=[p('BIDGUARD','BGTitle'),p('BID COMPLIANCE & RISK ASSESSMENT','Heading2'),p(assessment['title']),p(f"{assessment['reference']} | {bid['name']} | Assessment date: {assessment['assessment_date']}"),p('FICTIONAL DEMONSTRATION DATA' if assessment['sample'] else 'Procurement officer decision-support report','BGSmall')]
    story.append(p('Executive summary','Heading2'))
    summary=[['COMPLIANCE','RISK','REQUIREMENTS','NEEDS REVIEW'],[f"{risk['compliance']}%",f"{risk['score']}/100 - {risk['level']}",str(risk['total']),str(risk['counts']['NEEDS_REVIEW'])]]
    table=Table(summary,colWidths=[120]*4);table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e9f1e8')),('TEXTCOLOR',(0,0),(-1,-1),colors.HexColor('#153c2d')),('FONTNAME',(0,0),(-1,0),'Helvetica-Bold'),('FONTSIZE',(0,0),(-1,0),8),('FONTSIZE',(0,1),(-1,1),13),('BOTTOMPADDING',(0,0),(-1,-1),12),('TOPPADDING',(0,0),(-1,-1),12),('BOX',(0,0),(-1,-1),.5,colors.HexColor('#d8e3d5'))]));story.extend([table,Spacer(1,14),p(f"Compliant: {risk['counts']['COMPLIANT']} | Non-compliant: {risk['counts']['NON_COMPLIANT']} | Needs review: {risk['counts']['NEEDS_REVIEW']}"),p('Automated findings verify submitted text against confirmed rules. They do not certify document authenticity. No live government registry verification has been performed.','BGSmall')])
    decision=bid.get('decision');story.extend([p('Officer decision','Heading2'),p(f"{decision['decision']} - {decision['reviewer']}\n{decision['note']}" if decision else 'No final qualification decision recorded.')])
    story.append(p('Missing evidence and review priorities','Heading2'))
    for item in risk['missing']:story.append(p(f"{item['code']}: {item['document']} not located or incomplete."))
    if not risk['missing']:story.append(p('No missing evidence detected for the current rules.'))
    for factor in risk['factors']:story.append(p(f"+{factor['points']} risk points | {factor['code']}: {factor['reason']}"))
    story.append(p(risk['method'],'BGSmall'))
    story.append(PageBreak());story.append(p('Requirement-by-requirement findings','BGTitle'))
    for result in bid['results']:
        req=result['requirement'];heading=[p(f"{result['code']} | {req['text']}",'Heading2'),p(f"{result['status']} | {result['reason']}"),p(f"Rule {result['rule_id']}: {result['calculation']}"),p(f"Tender source: page {req['source_page']} | chunk {req['source_chunk']}",'BGSmall'),p(f"Tender clause: {req['source_quote']}",'BGSmall')]
        story.append(KeepTogether(heading))
        for e in result['evidence']:story.append(p(f"{e['document_name']} | page {e['page_number']} | chunk {e['id']}\n{e['text']}",'BGSmall'))
        if not result['evidence']:story.append(p('No supporting evidence was located.','BGSmall'))
        for review in result.get('reviews',[]):story.append(p(f"Officer review: {review['original_status']} -> {review['new_status']} | {review['reviewer']} | {review['timestamp']}\n{review['note']}"))
    story.append(PageBreak());story.append(p('Evidence index & audit record','BGTitle'))
    for doc in assessment['documents']:
        if doc['bid_id'] is None or doc['bid_id']==bid['id']:story.append(p(f"{doc['name']} | {doc['page_count']} pages\nSHA-256: {doc['sha256']}",'BGSmall'))
    story.append(p('Assessment activity','Heading2'))
    for event in assessment['audit']:story.append(p(f"{event['timestamp']} | {event['actor']} | {event['action']}\n{event['reason']}",'BGSmall'))
    def footer(canvas,doc):
        canvas.setStrokeColor(colors.HexColor('#dce5d9'));canvas.line(42,40,A4[0]-42,40);canvas.setFont('Helvetica',8);canvas.setFillColor(colors.HexColor('#627363'));canvas.drawString(42,27,'BIDGUARD | Evidence, not assumptions.');canvas.drawRightString(A4[0]-42,27,f'Page {doc.page}')
    SimpleDocTemplate(stream,pagesize=A4,leftMargin=42,rightMargin=42,topMargin=42,bottomMargin=54,title=f"BIDGUARD - {assessment['reference']}").build(story,onFirstPage=footer,onLaterPages=footer)
    return stream.getvalue()
