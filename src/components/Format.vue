<template>
	<div class="format-header">
		<span class="file-name">{{ fileName }}</span>
		<button class="format-btn" @click="formatCode">Format</button>
	</div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue'
import prettier from 'prettier/standalone'
import parserHtml from 'prettier/parser-html'
import parserCss from 'prettier/parser-postcss'
import parserBabel from 'prettier/parser-babel'

const props = defineProps({
	code: String,
	language: String,
	fileName: String
})
const emit = defineEmits(['format'])

function formatCode() {
	let formatted = props.code
	try {
		if (props.language === 'html') {
			formatted = prettier.format(props.code, { parser: 'html', plugins: [parserHtml] })
		} else if (props.language === 'css') {
			formatted = prettier.format(props.code, { parser: 'css', plugins: [parserCss] })
		} else if (props.language === 'javascript') {
			formatted = prettier.format(props.code, { parser: 'babel', plugins: [parserBabel] })
		}
	} catch (e) {
		// fallback: do not change code if formatting fails
	}
	emit('format', formatted)
}
</script>

<style scoped>
.format-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	background: #23272e;
	padding: 0 16px;
	height: 40px;
	border-bottom: 1px solid #333;
}
.file-name {
	font-weight: 500;
	color: #fff;
}
.format-btn {
	background: #40a9ff;
	color: #fff;
	border: none;
	border-radius: 4px;
	padding: 6px 16px;
	cursor: pointer;
	font-weight: 500;
	transition: background 0.2s;
}
.format-btn:hover {
	background: #1890ff;
}
</style>
