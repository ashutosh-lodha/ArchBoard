output "static_ip" {
  description = "Point the DNS A records for archboard and www.archboard here."
  value       = google_compute_address.ip.address
}

output "vm_name" {
  value = google_compute_instance.vm.name
}
