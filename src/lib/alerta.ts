import Swal, { type SweetAlertOptions } from 'sweetalert2'

/** SweetAlert2 con el tema del sistema aplicado en un solo lugar. */
const base: SweetAlertOptions = {
  customClass: { popup: 'siga-swal' },
  buttonsStyling: true,
  reverseButtons: true,
  confirmButtonColor: '#15803d',
  cancelButtonColor: '#64748b',
  denyButtonColor: '#dc2626',
}

export const alerta = {
  ok: (title: string, text?: string) =>
    Swal.fire({ ...base, icon: 'success', title, text, timer: 2200, showConfirmButton: false }),

  error: (title: string, text?: string) =>
    Swal.fire({ ...base, icon: 'error', title, text, confirmButtonText: 'Entendido' }),

  aviso: (title: string, text?: string) =>
    Swal.fire({ ...base, icon: 'warning', title, text, confirmButtonText: 'Entendido' }),

  info: (title: string, html?: string) =>
    Swal.fire({ ...base, icon: 'info', title, html, confirmButtonText: 'Cerrar' }),

  async confirmar(title: string, text?: string, confirmar = 'Confirmar') {
    const r = await Swal.fire({
      ...base,
      icon: 'question',
      title,
      text,
      showCancelButton: true,
      confirmButtonText: confirmar,
      cancelButtonText: 'Cancelar',
    })
    return r.isConfirmed
  },

  async eliminar(title: string, text?: string) {
    const r = await Swal.fire({
      ...base,
      icon: 'warning',
      title,
      text,
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
    })
    return r.isConfirmed
  },

  toast: (title: string, icon: 'success' | 'error' | 'warning' | 'info' = 'success') =>
    Swal.fire({
      ...base,
      toast: true,
      position: 'bottom-end',
      icon,
      title,
      showConfirmButton: false,
      timer: 2600,
      timerProgressBar: true,
    }),

  cargando: (title = 'Procesando…') => {
    Swal.fire({
      ...base,
      title,
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    })
  },

  cerrar: () => Swal.close(),
}
