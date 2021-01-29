initTinymce();

function initTinymce() {
	tinymce.init({
		selector:'textarea.tinymce',
		menubar: '',
		plugins: 'code lists paste',
		toolbar: 'undo redo | styleselect bold italic underline | alignleft aligncenter alignright | bullist numlist outdent indent | paste pastetext code'
	});
}