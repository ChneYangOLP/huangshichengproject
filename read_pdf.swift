import Quartz
import Foundation

let args = CommandLine.arguments
if args.count < 2 {
    print("Usage: swift read_pdf.swift <file.pdf>")
    exit(1)
}

let url = URL(fileURLWithPath: args[1])
if let pdf = PDFDocument(url: url) {
    print(pdf.string ?? "No text")
} else {
    print("Failed to open PDF")
}
