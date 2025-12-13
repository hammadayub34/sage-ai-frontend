#!/usr/bin/env python3
"""
Convert PDF to Markdown with image extraction
Usage: python3 convert_pdf_to_md.py <input.pdf> [output.md]
"""
import sys
import os
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:
    print("❌ PyMuPDF not installed. Install with: pip install pymupdf")
    sys.exit(1)

def pdf_to_markdown_with_images(pdf_path: str, output_path: str = None, images_dir: str = None):
    """Convert PDF to Markdown format, extracting and embedding images"""
    if not os.path.exists(pdf_path):
        print(f"❌ PDF file not found: {pdf_path}")
        return False
    
    pdf_name = Path(pdf_path).stem
    if output_path is None:
        output_path = pdf_path.replace('.pdf', '.md')
    
    # Create images directory
    if images_dir is None:
        images_dir = f"{pdf_name}_images"
    
    os.makedirs(images_dir, exist_ok=True)
    
    print(f"📖 Converting {pdf_path} to {output_path}...")
    print(f"📁 Images will be saved to: {images_dir}/")
    
    doc = fitz.open(pdf_path)
    markdown_content = []
    image_counter = 0
    
    for page_num, page in enumerate(doc, 1):
        # Extract text
        text = page.get_text()
        
        # Extract images
        image_list = page.get_images(full=True)
        
        markdown_content.append(f"## Page {page_num}\n\n")
        
        # Add text content
        if text.strip():
            markdown_content.append(f"{text}\n\n")
        
        # Extract and save images
        for img_index, img in enumerate(image_list):
            try:
                xref = img[0]
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]
                image_ext = base_image["ext"]
                
                image_filename = f"page_{page_num}_img_{img_index + 1}.{image_ext}"
                image_path = os.path.join(images_dir, image_filename)
                
                # Save image
                with open(image_path, "wb") as img_file:
                    img_file.write(image_bytes)
                
                # Add image reference to markdown
                markdown_content.append(f"![Image {img_index + 1}]({images_dir}/{image_filename})\n\n")
                image_counter += 1
            except Exception as e:
                print(f"⚠️  Warning: Could not extract image {img_index + 1} from page {page_num}: {e}")
                continue
        
        markdown_content.append("---\n\n")
    
    doc.close()
    
    # Write markdown file
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(''.join(markdown_content))
    
    print(f"✅ Converted to {output_path}")
    print(f"📸 Extracted {image_counter} image(s) to {images_dir}/")
    return True, output_path

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 convert_pdf_to_md.py <input.pdf> [output.md]")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else None
    
    success, md_path = pdf_to_markdown_with_images(pdf_path, output_path)
    if success:
        print(f"\n✅ Success! Markdown saved to: {md_path}")
        sys.exit(0)
    else:
        sys.exit(1)

